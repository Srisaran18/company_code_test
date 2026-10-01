const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const helpers = require("./helpers");

const app = helpers.loadApp();
const Material = require("../_lib/models/materialModel");
const MaterialRequest = require("../_lib/models/materialRequestModel");
const Role = require("../_lib/models/roleModel");
const User = require("../_lib/models/userModel");
const Company = require("../_lib/models/companyModel");
const { provisionCompany } = require("../_lib/data/seed");
const { SPLIT_CORE_FEATURES } = require("../_lib/utils/permissionCatalog");

const year = new Date().getFullYear();
const ctx = {};

function as(user) {
  const token = helpers.tokenFor(user);
  const wrap = (method) => (path) => request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
  return { get: wrap("get"), post: wrap("post"), put: wrap("put"), del: wrap("delete") };
}

before(async () => {
  await helpers.startDb();

  // Company A subscribes to Material Requests but NOT Procurement. Company B has both.
  ctx.A = await provisionCompany(
    { code: "COA", name: "Company A" },
    { featureKeys: [...SPLIT_CORE_FEATURES, "material_requests", "reports"] }
  );
  ctx.B = await provisionCompany(
    { code: "COB", name: "Company B" },
    { featureKeys: [...SPLIT_CORE_FEATURES, "material_requests", "procurement"] }
  );
  ctx.C = await provisionCompany({ code: "COC", name: "Company C" }, { featureKeys: [...SPLIT_CORE_FEATURES] });

  ctx.A1 = await helpers.makeProject(ctx.A, "Westfield Mall");
  ctx.A2 = await helpers.makeProject(ctx.A, "Another Mall");
  ctx.B1 = await helpers.makeProject(ctx.B, "Westfield Mall");

  ctx.A1eng = await helpers.makeDepartment(ctx.A, ctx.A1, "engineering", "Engineering");
  ctx.A1hvac = await helpers.makeDepartment(ctx.A, ctx.A1, "hvac", "HVAC");
  ctx.A2eng = await helpers.makeDepartment(ctx.A, ctx.A2, "engineering", "Engineering");
  ctx.B1eng = await helpers.makeDepartment(ctx.B, ctx.B1, "engineering", "Engineering");

  ctx.matA1eng = await helpers.makeMaterial(ctx.A, ctx.A1, ctx.A1eng, "BRG-1", "Bearing");
  ctx.matA1hvac = await helpers.makeMaterial(ctx.A, ctx.A1, ctx.A1hvac, "FLT-1", "Filter");
  ctx.matA2eng = await helpers.makeMaterial(ctx.A, ctx.A2, ctx.A2eng, "MTR-1", "Motor");
  ctx.matB = await helpers.makeMaterial(ctx.B, ctx.B1, ctx.B1eng, "BRG-1", "Bearing");

  ctx.adminA = await helpers.makeUser(ctx.A, { name: "Admin A", email: "admin@a.test", role: "super_admin", allProjects: true });
  ctx.engA1 = await helpers.makeUser(ctx.A, {
    name: "Engineer A1",
    email: "eng@a.test",
    role: "requestor",
    department: "engineering",
    projectIds: [ctx.A1._id],
  });
  ctx.adminB = await helpers.makeUser(ctx.B, { name: "Admin B", email: "admin@b.test", role: "super_admin", allProjects: true });
  ctx.reqB = await helpers.makeUser(ctx.B, {
    name: "Requestor B",
    email: "req@b.test",
    role: "requestor",
    department: "engineering",
    allProjects: true,
  });
  ctx.adminC = await helpers.makeUser(ctx.C, { name: "Admin C", email: "admin@c.test", role: "super_admin", allProjects: true });
  ctx.platform = await helpers.makeUser(null, {
    name: "Platform",
    email: "platform@servhub.test",
    role: "platform_admin",
    isPlatformAdmin: true,
  });

  const created = await as(ctx.reqB)
    .post("/material-requests")
    .send({
      projectId: ctx.B1._id.toString(),
      departmentId: ctx.B1eng._id.toString(),
      createdForId: ctx.reqB._id.toString(),
      products: [{ productId: "BRG-1", quantity: "2" }],
    });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  ctx.mrB = created.body.materialRequest;
});

after(async () => {
  await helpers.stopDb();
});

describe("1. Company A cannot read Company B data", () => {
  test("materials list never contains Company B records", async () => {
    const res = await as(ctx.adminA).get("/materials");
    assert.equal(res.status, 200);
    const ids = res.body.materials.map((item) => item.id);
    assert.ok(!ids.includes(ctx.matB._id.toString()));
    assert.equal(res.body.materials.filter((item) => item.name === "Bearing").length, 1);
  });

  test("users, roles and audits are company-scoped", async () => {
    const users = await as(ctx.adminA).get("/users");
    assert.ok(users.body.users.every((item) => item.companyId === ctx.A._id.toString()));
    assert.ok(!users.body.users.some((item) => item.email === "admin@b.test"));

    const roles = await as(ctx.adminA).get("/roles");
    const bRoleIds = (await Role.find({ companyId: ctx.B._id })).map((item) => item._id.toString());
    assert.ok(roles.body.roles.every((item) => !bRoleIds.includes(item.id)));

    const audits = await as(ctx.adminA).get("/audits");
    assert.equal(audits.status, 200);
    assert.ok(!audits.body.audits.some((item) => item.actorEmail === "req@b.test"));
  });

  test("session directory only exposes the caller's company", async () => {
    const res = await as(ctx.adminA).get("/auth/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.company.code, "COA");
    assert.ok(!res.body.directory.users.some((item) => item.email.endsWith("@b.test")));
    assert.ok(!res.body.directory.departments.some((item) => item.id === ctx.B1eng._id.toString()));
  });
});

describe("2/3. Company A cannot update or delete Company B data", () => {
  test("update B material via URL id → 404, record unchanged", async () => {
    const res = await as(ctx.adminA)
      .put(`/materials/${ctx.matB._id}`)
      .send({ productId: "HACK", name: "Hacked", projectId: ctx.A1._id.toString(), departmentId: ctx.A1eng._id.toString() });
    assert.equal(res.status, 404);
    const fresh = await Material.findOne({ companyId: ctx.B._id, _id: ctx.matB._id });
    assert.equal(fresh.name, "Bearing");
  });

  test("delete B material / user / role → 404, records survive", async () => {
    assert.equal((await as(ctx.adminA).del(`/materials/${ctx.matB._id}`)).status, 404);
    assert.equal((await as(ctx.adminA).del(`/users/${ctx.reqB._id}`)).status, 404);
    const roleB = await Role.findOne({ companyId: ctx.B._id, key: "procurement" });
    assert.equal((await as(ctx.adminA).del(`/roles/${roleB._id}`)).status, 404);

    assert.ok(await Material.exists({ companyId: ctx.B._id, _id: ctx.matB._id }));
    assert.ok(await User.exists({ companyId: ctx.B._id, _id: ctx.reqB._id }));
    assert.ok(await Role.exists({ companyId: ctx.B._id, _id: roleB._id }));
  });

  test("update B user → 404", async () => {
    const res = await as(ctx.adminA).put(`/users/${ctx.reqB._id}`).send({ name: "Hacked" });
    assert.equal(res.status, 404);
    const fresh = await User.findOne({ companyId: ctx.B._id, _id: ctx.reqB._id });
    assert.equal(fresh.name, "Requestor B");
  });
});

describe("4. Company A cannot access Company B projects", () => {
  test("project detail/update/delete by B id → 404; list excludes B", async () => {
    assert.equal((await as(ctx.adminA).get(`/projects/${ctx.B1._id}`)).status, 404);
    assert.equal((await as(ctx.adminA).put(`/projects/${ctx.B1._id}`).send({ name: "x" })).status, 404);
    assert.equal((await as(ctx.adminA).del(`/projects/${ctx.B1._id}`)).status, 404);
    const list = await as(ctx.adminA).get("/projects");
    assert.ok(!list.body.projects.some((item) => item.id === ctx.B1._id.toString()));
  });

  test("cannot create a material on a B project", async () => {
    const res = await as(ctx.adminA)
      .post("/materials")
      .send({ productId: "X-1", name: "X", projectId: ctx.B1._id.toString(), departmentId: ctx.B1eng._id.toString() });
    assert.equal(res.status, 404);
  });
});

describe("5. Company A cannot access Company B departments", () => {
  test("department update/delete by B id → 404; list excludes B", async () => {
    assert.equal((await as(ctx.adminA).put(`/departments/${ctx.B1eng._id}`).send({ name: "x" })).status, 404);
    assert.equal((await as(ctx.adminA).del(`/departments/${ctx.B1eng._id}`)).status, 404);
    const list = await as(ctx.adminA).get("/departments");
    assert.ok(!list.body.departments.some((item) => item.id === ctx.B1eng._id.toString()));
  });

  test("B department on an A project is rejected", async () => {
    const res = await as(ctx.adminA)
      .post("/materials")
      .send({ productId: "X-2", name: "X", projectId: ctx.A1._id.toString(), departmentId: ctx.B1eng._id.toString() });
    assert.equal(res.status, 404);
  });

  test("department from another project of the same company is rejected", async () => {
    const res = await as(ctx.adminA)
      .post("/materials")
      .send({ productId: "X-3", name: "X", projectId: ctx.A1._id.toString(), departmentId: ctx.A2eng._id.toString() });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "DEPARTMENT_PROJECT_MISMATCH");
  });
});

describe("6. Company A cannot access Company B material requests", () => {
  test("get/update/delete B MR number → 404", async () => {
    assert.equal((await as(ctx.adminA).get(`/material-requests/${ctx.mrB.mrNo}`)).status, 404);
    assert.equal(
      (await as(ctx.adminA).put(`/material-requests/${ctx.mrB.mrNo}`).send({ justification: "x" })).status,
      404
    );
    assert.equal((await as(ctx.adminA).del(`/material-requests/${ctx.mrB.mrNo}`)).status, 404);
    const list = await as(ctx.adminA).get("/material-requests");
    assert.equal(list.status, 200);
    assert.equal(list.body.materialRequests.length, 0);
  });

  test("document numbers are per company: A's first MR reuses B's number without collision", async () => {
    const res = await as(ctx.engA1)
      .post("/material-requests")
      .send({
        projectId: ctx.A1._id.toString(),
        departmentId: ctx.A1eng._id.toString(),
        createdForId: ctx.engA1._id.toString(),
        products: [{ productId: "BRG-1", quantity: "1" }],
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.materialRequest.mrNo, `MR-${year}-000001`);
    assert.equal(ctx.mrB.mrNo, `MR-${year}-000001`);
    ctx.mrA = res.body.materialRequest;

    const own = await as(ctx.adminA).get(`/material-requests/${ctx.mrA.mrNo}`);
    assert.equal(own.body.materialRequest.projectId, ctx.A1._id.toString());
  });
});

describe("7/8. Company roles and permissions are isolated", () => {
  test("cannot edit B's role by id", async () => {
    const roleB = await Role.findOne({ companyId: ctx.B._id, key: "manager" });
    const res = await as(ctx.adminA)
      .put(`/roles/${roleB._id}`)
      .send({ name: "Hacked", key: "manager", privileges: { users: ["view", "create", "edit", "delete"] } });
    assert.equal(res.status, 404);
    const fresh = await Role.findOne({ companyId: ctx.B._id, _id: roleB._id });
    assert.notEqual(fresh.name, "Hacked");
    assert.equal(fresh.privileges.users, undefined);
  });

  test("editing A's Manager permissions leaves B's Manager unchanged", async () => {
    const roleA = await Role.findOne({ companyId: ctx.A._id, key: "manager" });
    const before = await Role.findOne({ companyId: ctx.B._id, key: "manager" });
    const res = await as(ctx.adminA)
      .put(`/roles/${roleA._id}`)
      .send({ name: roleA.name, key: "manager", privileges: { dashboard: ["view"], materials: ["view"] } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const afterA = await Role.findOne({ companyId: ctx.A._id, _id: roleA._id });
    const afterB = await Role.findOne({ companyId: ctx.B._id, _id: before._id });
    assert.deepEqual(afterA.privileges.materials, ["view"]);
    assert.deepEqual(afterB.privileges, before.privileges);
  });

  test("POST with an existing key creates/updates only A's role", async () => {
    const res = await as(ctx.adminA).post("/roles").send({ name: "Store Keeper", key: "store_keeper" });
    assert.equal(res.status, 201);
    assert.equal(await Role.countDocuments({ companyId: ctx.B._id, key: "store_keeper" }), 0);
  });

  test("unknown permissions are rejected", async () => {
    const res = await as(ctx.adminA).post("/roles").send({ name: "Bad", key: "bad", privileges: { nuke: ["all"] } });
    assert.equal(res.status, 400);
  });

  test("cannot assign a role that only exists in another company", async () => {
    await as(ctx.adminB).post("/roles").send({ name: "B only", key: "b_only" });
    const res = await as(ctx.adminA)
      .post("/users")
      .send({ name: "x", email: "x@a.test", role: "b_only", department: "engineering" });
    assert.equal(res.status, 403);
  });
});

describe("9. Unsubscribed features are blocked at the API", () => {
  test("Company A has no Procurement: moving an MR into sourcing → FEATURE_NOT_ENABLED", async () => {
    await MaterialRequest.updateOne({ companyId: ctx.A._id, mrNo: ctx.mrA.mrNo }, { status: "Approved" });
    const res = await as(ctx.adminA).put(`/material-requests/${ctx.mrA.mrNo}`).send({ status: "Sourcing" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FEATURE_NOT_ENABLED");
    assert.equal(res.body.success, false);
  });

  test("Company A cannot submit quotations without Procurement", async () => {
    const res = await as(ctx.adminA).put(`/material-requests/${ctx.mrA.mrNo}`).send({ quotation: "Q" });
    assert.equal(res.body.code, "FEATURE_NOT_ENABLED");
  });

  test("Company C has no Material Requests: MR and material APIs → 403", async () => {
    for (const path of ["/material-requests", "/materials"]) {
      const res = await as(ctx.adminC).get(path);
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "FEATURE_NOT_ENABLED");
    }
  });

  test("privileges for disabled features are stripped from the session", async () => {
    const res = await as(ctx.adminC).get("/auth/me");
    assert.equal(res.body.privileges.material_requests, undefined);
    assert.ok(!res.body.features.includes("material_requests"));
    const resA = await as(ctx.adminA).get("/auth/me");
    assert.equal(resA.body.privileges.procurement, undefined);
  });
});

describe("10. Users without permission are refused", () => {
  test("requestor cannot manage materials, users, roles or audits", async () => {
    const payload = { productId: "Z", name: "Z", projectId: ctx.A1._id.toString(), departmentId: ctx.A1eng._id.toString() };
    assert.equal((await as(ctx.engA1).post("/materials").send(payload)).status, 403);
    assert.equal((await as(ctx.engA1).get("/users")).status, 403);
    assert.equal((await as(ctx.engA1).get("/roles")).status, 403);
    assert.equal((await as(ctx.engA1).get("/audits")).status, 403);
    assert.equal((await as(ctx.engA1).post("/projects").send({ name: "Mine" })).status, 403);
    assert.equal((await as(ctx.engA1).put("/company").send({ name: "Mine" })).status, 403);
  });

  test("unauthenticated requests are refused", async () => {
    assert.equal((await request(app).get("/api/v1/materials")).status, 401);
  });
});

describe("11. companyId in the request cannot bypass isolation", () => {
  test("body companyId of another company → TENANT_MISMATCH", async () => {
    const res = await as(ctx.adminA)
      .post("/projects")
      .send({ name: "Sneaky", companyId: ctx.B._id.toString() });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "TENANT_MISMATCH");
    assert.equal(await require("../_lib/models/projectModel").countDocuments({ companyId: ctx.B._id, key: "sneaky" }), 0);
  });

  test("query companyId of another company → TENANT_MISMATCH", async () => {
    const res = await as(ctx.adminA).get(`/materials?companyId=${ctx.B._id}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "TENANT_MISMATCH");
  });

  test("own companyId in the body is ignored, record goes to the caller's company", async () => {
    const res = await as(ctx.adminA).post("/projects").send({ name: "Legit", companyId: ctx.A._id.toString() });
    assert.equal(res.status, 201);
  });
});

describe("12. Another company's ids in the URL", () => {
  test("every B id/number in the URL resolves to 404 for A", async () => {
    const roleB = await Role.findOne({ companyId: ctx.B._id, key: "manager" });
    // A now owns its own MR with the same number: the lookup must return A's record, never B's.
    const sameNumber = await as(ctx.adminA).get(`/material-requests/${ctx.mrB.mrNo}`);
    assert.equal(sameNumber.status, 200);
    assert.equal(sameNumber.body.materialRequest.projectId, ctx.A1._id.toString());
    assert.notEqual(sameNumber.body.materialRequest.projectId, ctx.mrB.projectId);

    const checks = [
      as(ctx.adminA).get(`/projects/${ctx.B1._id}`),
      as(ctx.adminA).put(`/users/${ctx.adminB._id}`).send({ active: false }),
      as(ctx.adminA).put(`/departments/${ctx.B1eng._id}`).send({ name: "x" }),
      as(ctx.adminA).put(`/roles/${roleB._id}`).send({ name: "x", key: "manager" }),
      as(ctx.adminA).get(`/materials/managers?projectId=${ctx.B1._id}&departmentId=${ctx.B1eng._id}`),
    ];
    for (const res of await Promise.all(checks)) assert.equal(res.status, 404, res.req.path);
  });
});

describe("Project and department scope inside one company", () => {
  test("A1 engineer sees only A1 Engineering materials", async () => {
    const res = await as(ctx.engA1).get("/materials");
    const ids = res.body.materials.map((item) => item.id);
    assert.deepEqual(ids, [ctx.matA1eng._id.toString()]);
  });

  test("A1 engineer cannot raise an MR on project A2", async () => {
    const res = await as(ctx.engA1)
      .post("/material-requests")
      .send({
        projectId: ctx.A2._id.toString(),
        departmentId: ctx.A2eng._id.toString(),
        createdForId: ctx.engA1._id.toString(),
        products: [{ productId: "MTR-1", quantity: "1" }],
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "PROJECT_ACCESS_DENIED");
  });

  test("A1 engineer cannot raise an MR for HVAC", async () => {
    const res = await as(ctx.engA1)
      .post("/material-requests")
      .send({
        projectId: ctx.A1._id.toString(),
        departmentId: ctx.A1hvac._id.toString(),
        createdForId: ctx.engA1._id.toString(),
        products: [{ productId: "FLT-1", quantity: "1" }],
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "DEPARTMENT_ACCESS_DENIED");
  });

  test("admin cannot grant a project of another company", async () => {
    const res = await as(ctx.adminA)
      .post("/users")
      .send({ name: "y", email: "y@a.test", role: "requestor", department: "engineering", projectIds: [ctx.B1._id.toString()] });
    assert.equal(res.status, 404);
  });
});

describe("Platform vs company administration", () => {
  test("platform admin cannot read company data; company admin cannot use platform APIs", async () => {
    const tenantRes = await as(ctx.platform).get("/material-requests");
    assert.equal(tenantRes.status, 403);
    assert.equal(tenantRes.body.code, "TENANT_REQUIRED");
    const platformRes = await as(ctx.adminA).get("/platform/companies");
    assert.equal(platformRes.status, 403);
  });

  test("Company Settings is blocked for Super Admin when the feature is off", async () => {
    const off = await as(ctx.platform)
      .put(`/platform/companies/${ctx.C._id}/features`)
      .send({ features: [{ key: "company_settings", enabled: false }] });
    assert.equal(off.status, 200);
    const denied = await as(ctx.adminC).get("/company");
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "FEATURE_NOT_ENABLED");
    const meOff = await as(ctx.adminC).get("/auth/me");
    assert.ok(!meOff.body.features.includes("company_settings"));

    const on = await as(ctx.platform)
      .put(`/platform/companies/${ctx.C._id}/features`)
      .send({ features: [{ key: "company_settings", enabled: true }] });
    assert.equal(on.status, 200);
    assert.equal((await as(ctx.adminC).get("/company")).status, 200);
    const meOn = await as(ctx.adminC).get("/auth/me");
    assert.ok(meOn.body.features.includes("company_settings"));
  });

  test("platform admin toggles features and suspends companies", async () => {
    const enable = await as(ctx.platform)
      .put(`/platform/companies/${ctx.C._id}/features`)
      .send({ features: [{ key: "material_requests", enabled: true }] });
    assert.equal(enable.status, 200);
    assert.equal((await as(ctx.adminC).get("/materials")).status, 200);

    const suspend = await as(ctx.platform).put(`/platform/companies/${ctx.C._id}`).send({ status: "suspended" });
    assert.equal(suspend.status, 200);
    const blocked = await as(ctx.adminC).get("/materials");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "COMPANY_INACTIVE");
    await Company.updateOne({ _id: ctx.C._id }, { status: "active" });
  });

  test("platform creates a company with its own system roles and admin", async () => {
    const res = await as(ctx.platform)
      .post("/platform/companies")
      .send({
        code: "9001",
        name: "New Co",
        features: ["material_requests"],
        plan: { mode: "subscription", duration: 12 },
        admin: { email: "boss@newco.test", name: "Boss", password: "secret123" },
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const roles = await Role.find({ companyId: res.body.company.id });
    assert.ok(roles.some((item) => item.key === "super_admin" && item.isSystemRole));
    assert.ok(res.body.adminPassword);
    assert.equal(res.body.adminPasswordEmailed, false);
  });

  test("company creation returns the password when SMTP is unset", async () => {
    const previous = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
    };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    try {
      const res = await as(ctx.platform)
        .post("/platform/companies")
        .send({
          name: "No Mail Co",
          plan: { mode: "demo", duration: 5 },
          admin: { email: "nomail@newco.test", name: "No Mail" },
        });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.adminPasswordEmailed, false);
      assert.equal(typeof res.body.adminPassword, "string");
      assert.ok(res.body.adminPassword.length >= 6);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test("platform generates a company code and returns that company's audits", async () => {
    const res = await as(ctx.platform)
      .post("/platform/companies")
      .send({
        name: "Default Code Co",
        timezone: "Asia/Riyadh",
        plan: { mode: "demo", duration: 10 },
        admin: { email: "boss2@newco.test", name: "Boss" },
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.company.code, /^\d+$/);
    assert.match(res.body.company.timezone, /Riyadh|UTC/);

    const detail = await as(ctx.platform).get(`/platform/companies/${res.body.company.id}`);
    assert.equal(detail.status, 200);
    const admin = detail.body.admins.find((item) => item.email === "boss2@newco.test");
    assert.ok(admin);
    assert.match(admin.password, /^\$2[aby]\$/);

    const reset = await as(ctx.platform)
      .put(`/platform/companies/${res.body.company.id}/admins/${admin.id}/password`)
      .send({ password: "changed1" });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.match(reset.body.admin.password, /^\$2[aby]\$/);
    assert.notEqual(reset.body.admin.password, admin.password);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "boss2@newco.test", password: "changed1" });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const tooShort = await as(ctx.platform)
      .put(`/platform/companies/${res.body.company.id}/admins/${admin.id}/password`)
      .send({ password: "abc" });
    assert.equal(tooShort.status, 400);
    const material = detail.body.features.find((item) => item.key === "material_requests");
    assert.ok(material.modules.some((item) => item.key === "material_requests"));

    const audits = await as(ctx.platform).get(`/platform/companies/${res.body.company.id}/audits`);
    assert.equal(audits.status, 200);
    assert.ok(audits.body.audits.some((item) => String(item.summary).includes(res.body.company.code)));

    const other = await as(ctx.platform).get(`/platform/companies/${ctx.A._id}/audits`);
    assert.equal(other.status, 200);
    assert.ok(!other.body.audits.some((item) => String(item.summary).includes(res.body.company.code)));
    assert.equal((await as(ctx.adminA).get(`/platform/companies/${ctx.A._id}/audits`)).status, 403);
  });

  test("company plan: demo days, subscription months, expiry blocks access", async () => {
    const bad = await as(ctx.platform)
      .post("/platform/companies")
      .send({ name: "Bad Plan Co", plan: { mode: "demo", duration: 7 } });
    assert.equal(bad.status, 400);
    const missing = await as(ctx.platform).post("/platform/companies").send({ name: "No Plan Co" });
    assert.equal(missing.status, 400);

    const res = await as(ctx.platform)
      .post("/platform/companies")
      .send({
        name: "Demo Plan Co",
        plan: { mode: "demo", duration: 15 },
        admin: { name: "Demo Boss", email: "demoplan@newco.test", password: "secret123" },
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.company.plan.mode, "demo");
    assert.equal(res.body.company.plan.unit, "days");
    assert.equal(res.body.company.plan.daysLeft, 15);
    for (const feature of res.body.features) {
      assert.equal(feature.enabled, feature.alwaysOn, `${feature.key} should start unticked`);
      if (feature.alwaysOn) continue;
      assert.equal(new Date(feature.startDate).getTime(), new Date(res.body.company.plan.startDate).getTime());
      assert.equal(new Date(feature.endDate).getTime(), new Date(res.body.company.plan.endDate).getTime());
    }

    const upgraded = await as(ctx.platform)
      .put(`/platform/companies/${res.body.company.id}`)
      .send({ plan: { mode: "subscription", duration: 6 } });
    assert.equal(upgraded.status, 200, JSON.stringify(upgraded.body));
    assert.equal(upgraded.body.company.plan.mode, "subscription");
    assert.equal(upgraded.body.company.plan.unit, "months");
    const procurement = upgraded.body.features.find((item) => item.key === "procurement");
    assert.equal(procurement.enabled, false);
    assert.equal(new Date(procurement.endDate).getTime(), new Date(upgraded.body.company.plan.endDate).getTime());

    const boss = await helpers.makeUser(
      { _id: res.body.company.id },
      { name: "Demo Boss", email: "boss@demoplan.test", role: "super_admin", allProjects: true }
    );
    assert.equal((await as(boss).get("/users")).status, 403);
    assert.equal((await as(boss).get("/audits")).status, 200);
    await as(ctx.platform)
      .put(`/platform/companies/${res.body.company.id}/features`)
      .send({ features: [{ key: "users", enabled: true }] });
    assert.equal((await as(boss).get("/users")).status, 200);
    assert.equal((await as(boss).get("/audits")).status, 200);

    const past = new Date(Date.now() - 20 * 86400000);
    await Company.updateOne({ _id: ctx.A._id }, { plan: { mode: "demo", duration: 5, unit: "days", startDate: past, endDate: new Date(past.getTime() + 5 * 86400000) } });
    const blocked = await as(ctx.adminA).get("/projects");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "COMPANY_PLAN_EXPIRED");
    await Company.updateOne({ _id: ctx.A._id }, { $unset: { plan: 1 } });
    assert.equal((await as(ctx.adminA).get("/projects")).status, 200);
  });

  test("platform dashboard and audit filters", async () => {
    const dash = await as(ctx.platform).get("/platform/dashboard");
    assert.equal(dash.status, 200, JSON.stringify(dash.body));
    assert.ok(dash.body.kpis.companiesTotal >= 3);
    assert.equal(dash.body.usageByDay.length, 14);

    const platformAudits = await as(ctx.platform).get("/platform/audits?actor=platform");
    assert.equal(platformAudits.status, 200, JSON.stringify(platformAudits.body));
    assert.ok(platformAudits.body.audits.every((item) => item.isPlatformActor === true));
    assert.ok(platformAudits.body.companies.some((item) => item.code === "COA"));

    const companyA = await as(ctx.platform).get(`/platform/audits?company=${ctx.A._id}`);
    assert.equal(companyA.status, 200);
    assert.ok(companyA.body.audits.every((item) => item.companyId === String(ctx.A._id)));

    const search = await as(ctx.platform).get("/platform/audits?q=COA");
    assert.equal(search.status, 200);
  });

  test("login audits record the access IP", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", "203.0.113.10")
      .send({ email: "platform@servhub.test", password: "secret123" });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const audits = await as(ctx.platform).get("/platform/audits?q=203.0.113.10");
    assert.equal(audits.status, 200);
    assert.ok(audits.body.audits.some((item) => item.ip === "203.0.113.10" && item.action === "login"));
  });

  test("project code defaults from the project name", async () => {
    const res = await as(ctx.adminA).post("/projects").send({ name: "Harbor Tower" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.project.code, "HARBORTOWER");
  });
});

describe("Tenant guard", () => {
  test("queries without companyId throw", async () => {
    await assert.rejects(() => Material.find({ name: "Bearing" }), /Tenant guard/);
    await assert.rejects(() => Material.deleteMany({}), /Tenant guard/);
  });
});
