from tests.conftest import create_user, login


async def register_and_verify(client, username="juan", password="Secret123"):
    r = await client.post(
        "/auth/register",
        json={"email": f"{username}@example.com", "username": username, "password": password},
    )
    assert r.status_code == 201, r.text
    token = r.json()["dev_verification_token"]
    v = await client.post("/auth/verify-email", json={"token": token})
    assert v.status_code == 200
    return r.json()["user"]


async def test_register_requires_verification_then_login_and_me(client):
    r = await client.post(
        "/auth/register",
        json={"email": "Juan@Example.com", "username": "Juan", "password": "Secret123"},
    )
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "juan@example.com"
    assert r.json()["user"]["roles"] == ["user"]

    # Sin verificar no puede entrar
    denied = await login(client, "juan", "Secret123")
    assert denied.status_code == 403

    token = r.json()["dev_verification_token"]
    assert (await client.post("/auth/verify-email", json={"token": token})).status_code == 200
    # El token es de un solo uso
    assert (await client.post("/auth/verify-email", json={"token": token})).status_code == 400

    ok = await login(client, "juan@example.com", "Secret123")
    assert ok.status_code == 200
    access = ok.json()["access_token"]
    me = await client.get("/users/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    body = me.json()
    assert body["username"] == "juan"
    assert body["roles"] == ["user"]
    assert set(body["permissions"]) == {"profile:read", "profile:write"}


async def test_register_duplicate_and_weak_password(client):
    await register_and_verify(client)
    dup = await client.post(
        "/auth/register",
        json={"email": "juan@example.com", "username": "otro", "password": "Secret123"},
    )
    assert dup.status_code == 409
    weak = await client.post(
        "/auth/register",
        json={"email": "a@example.com", "username": "abc", "password": "short"},
    )
    assert weak.status_code == 422


async def test_protected_routes_need_valid_token(client):
    assert (await client.get("/users/me")).status_code == 401
    bad = await client.get("/users/me", headers={"Authorization": "Bearer nope"})
    assert bad.status_code == 401


async def test_refresh_token_cannot_be_used_as_access(client):
    await register_and_verify(client)
    tokens = (await login(client, "juan", "Secret123")).json()
    r = await client.get("/users/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert r.status_code == 401


async def test_lockout_after_failed_attempts(client):
    await register_and_verify(client)
    for _ in range(3):
        assert (await login(client, "juan", "Wrong123")).status_code == 401
    locked = await login(client, "juan", "Secret123")  # incluso con la clave correcta
    assert locked.status_code == 423


async def test_inactive_user_cannot_login(client, session_factory):
    await create_user(session_factory, "ghost", "Secret123", active=False)
    assert (await login(client, "ghost", "Secret123")).status_code == 403


async def test_refresh_rotation_and_reuse_detection(client):
    await register_and_verify(client)
    first = (await login(client, "juan", "Secret123")).json()

    second = await client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    second = second.json()
    assert second["refresh_token"] != first["refresh_token"]

    # Reusar el token ya rotado -> 401 y se revoca toda la familia
    reuse = await client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reuse.status_code == 401
    after = await client.post("/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert after.status_code == 401


async def test_logout_blacklists_access_token(client):
    await register_and_verify(client)
    tokens = (await login(client, "juan", "Secret123")).json()
    h = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (await client.get("/users/me", headers=h)).status_code == 200

    out = await client.post("/auth/logout", headers=h, json={"refresh_token": tokens["refresh_token"]})
    assert out.status_code == 200
    assert (await client.get("/users/me", headers=h)).status_code == 401
    assert (
        await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 401


async def test_logout_all_revokes_every_session(client):
    await register_and_verify(client)
    a = (await login(client, "juan", "Secret123")).json()
    b = (await login(client, "juan", "Secret123")).json()
    h = {"Authorization": f"Bearer {a['access_token']}"}
    assert (await client.post("/auth/logout-all", headers=h)).status_code == 200
    for t in (a, b):
        assert (await client.post("/auth/refresh", json={"refresh_token": t["refresh_token"]})).status_code == 401


async def test_password_reset_flow(client):
    await register_and_verify(client)
    old = (await login(client, "juan", "Secret123")).json()

    # Respuesta genérica incluso si el correo no existe
    ghost = await client.post("/auth/forgot-password", json={"email": "nadie@example.com"})
    assert ghost.status_code == 202 and ghost.json()["dev_token"] is None

    r = await client.post("/auth/forgot-password", json={"email": "juan@example.com"})
    token = r.json()["dev_token"]
    assert token

    done = await client.post(
        "/auth/reset-password", json={"token": token, "new_password": "NewSecret456"}
    )
    assert done.status_code == 200
    assert (
        await client.post("/auth/reset-password", json={"token": token, "new_password": "Another789"})
    ).status_code == 400

    assert (await login(client, "juan", "Secret123")).status_code == 401
    assert (await login(client, "juan", "NewSecret456")).status_code == 200
    # Las sesiones anteriores quedan revocadas
    assert (
        await client.post("/auth/refresh", json={"refresh_token": old["refresh_token"]})
    ).status_code == 401


async def test_change_password(client):
    await register_and_verify(client)
    tokens = (await login(client, "juan", "Secret123")).json()
    h = {"Authorization": f"Bearer {tokens['access_token']}"}

    bad = await client.post(
        "/auth/change-password", headers=h,
        json={"current_password": "Wrong123", "new_password": "NewSecret456"},
    )
    assert bad.status_code == 400

    ok = await client.post(
        "/auth/change-password", headers=h,
        json={"current_password": "Secret123", "new_password": "NewSecret456"},
    )
    assert ok.status_code == 200
    assert (await client.get("/users/me", headers=h)).status_code == 401  # access revocado
    assert (await login(client, "juan", "NewSecret456")).status_code == 200


async def test_oauth2_form_login_for_swagger(client):
    await register_and_verify(client)
    r = await client.post("/auth/token", data={"username": "juan", "password": "Secret123"})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"
