from tests.conftest import create_user, login


async def headers_for(client, factory, username, role):
    await create_user(factory, username, "Secret123", role=role)
    tokens = (await login(client, username, "Secret123")).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_permission_enforcement(client, session_factory, admin_headers):
    user_h = await headers_for(client, session_factory, "plain", "user")
    mgr_h = await headers_for(client, session_factory, "boss", "manager")

    assert (await client.get("/users", headers=user_h)).status_code == 403
    assert (await client.get("/users", headers=mgr_h)).status_code == 200
    assert (await client.get("/users", headers=admin_headers)).status_code == 200

    # manager no tiene users:delete ni roles:write
    users = (await client.get("/users", headers=admin_headers)).json()["items"]
    target = next(u for u in users if u["username"] == "plain")
    assert (await client.delete(f"/users/{target['id']}", headers=mgr_h)).status_code == 403
    assert (await client.get("/roles", headers=mgr_h)).status_code == 200
    assert (await client.post("/roles", headers=mgr_h, json={"name": "x_role"})).status_code == 403


async def test_admin_assigns_role_and_effect_is_immediate(client, session_factory, admin_headers):
    user_h = await headers_for(client, session_factory, "plain", "user")
    assert (await client.get("/users", headers=user_h)).status_code == 403

    users = (await client.get("/users", headers=admin_headers)).json()["items"]
    target = next(u for u in users if u["username"] == "plain")
    roles = (await client.get("/roles", headers=admin_headers)).json()
    manager = next(r for r in roles if r["name"] == "manager")

    r = await client.put(f"/users/{target['id']}/roles/{manager['id']}", headers=admin_headers)
    assert r.status_code == 200 and "manager" in r.json()["roles"]

    # Mismo access token, permisos nuevos al instante (se leen de la BD)
    assert (await client.get("/users", headers=user_h)).status_code == 200

    r = await client.delete(f"/users/{target['id']}/roles/{manager['id']}", headers=admin_headers)
    assert r.status_code == 200
    assert (await client.get("/users", headers=user_h)).status_code == 403


async def test_admin_cannot_remove_own_admin_role_or_deactivate_self(client, admin_headers):
    me = (await client.get("/users/me", headers=admin_headers)).json()
    roles = (await client.get("/roles", headers=admin_headers)).json()
    admin_role = next(r for r in roles if r["name"] == "admin")
    assert (
        await client.delete(f"/users/{me['id']}/roles/{admin_role['id']}", headers=admin_headers)
    ).status_code == 400
    assert (
        await client.patch(f"/users/{me['id']}", headers=admin_headers, json={"is_active": False})
    ).status_code == 400
    assert (await client.delete(f"/users/{me['id']}", headers=admin_headers)).status_code == 400


async def test_deactivating_user_blocks_access_and_refresh(client, session_factory, admin_headers):
    await create_user(session_factory, "victim", "Secret123")
    tokens = (await login(client, "victim", "Secret123")).json()
    h = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (await client.get("/users/me", headers=h)).status_code == 200

    users = (await client.get("/users?q=victim", headers=admin_headers)).json()["items"]
    r = await client.patch(f"/users/{users[0]['id']}", headers=admin_headers, json={"is_active": False})
    assert r.status_code == 200

    assert (await client.get("/users/me", headers=h)).status_code == 401
    assert (
        await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 401


async def test_create_role_and_set_permissions(client, admin_headers):
    r = await client.post("/roles", headers=admin_headers, json={"name": "support", "description": "Soporte"})
    assert r.status_code == 201
    role_id = r.json()["id"]
    assert (await client.post("/roles", headers=admin_headers, json={"name": "support"})).status_code == 409

    ok = await client.put(
        f"/roles/{role_id}/permissions", headers=admin_headers,
        json={"permission_codes": ["users:read", "audit:read"]},
    )
    assert ok.status_code == 200
    assert {p["code"] for p in ok.json()["permissions"]} == {"users:read", "audit:read"}

    bad = await client.put(
        f"/roles/{role_id}/permissions", headers=admin_headers,
        json={"permission_codes": ["nope:nope"]},
    )
    assert bad.status_code == 422


async def test_audit_logs_visible_to_admin_only(client, session_factory, admin_headers):
    user_h = await headers_for(client, session_factory, "plain", "user")
    assert (await client.get("/audit-logs", headers=user_h)).status_code == 403

    await login(client, "plain", "Wrong123")
    r = await client.get("/audit-logs?event=login_failed&success=false", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert body["items"][0]["event"] == "login_failed"
    assert body["items"][0]["metadata"]["reason"] == "invalid_password"
