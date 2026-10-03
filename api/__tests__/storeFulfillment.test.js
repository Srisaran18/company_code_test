const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const helpers = require("./helpers");

const app = helpers.loadApp();
const Material = require("../_lib/models/materialModel");
const { provisionCompany } = require("../_lib/data/seed");
const { SPLIT_CORE_FEATURES } = require("../_lib/utils/permissionCatalog");

const ctx = {};

function as(user) {
  const token = helpers.tokenFor(user);
  const wrap = (method) => (path) => request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
  return { get: wrap("get"), post: wrap("post"), put: wrap("put") };
}

before(async () => {
  await helpers.startDb();
  ctx.company = await provisionCompany(
    { code: "STOR", name: "Store Co" },
    { featureKeys: [...SPLIT_CORE_FEATURES, "material_requests", "procurement"] }
  );
  ctx.project = await helpers.makeProject(ctx.company, "Warehouse");
  ctx.department = await helpers.makeDepartment(ctx.company, ctx.project, "cleaning", "Cleaning");
  ctx.material = await helpers.makeMaterial(ctx.company, ctx.project, ctx.department, "CLN-1", "Cleaner");
  await Material.updateOne({ _id: ctx.material._id, companyId: ctx.company._id }, { stock: 4 });
  ctx.admin = await helpers.makeUser(ctx.company, {
    name: "Admin",
    email: "admin@store.test",
    role: "super_admin",
    allProjects: true,
  });
  ctx.requestor = await helpers.makeUser(ctx.company, {
    name: "Cleaner",
    email: "clean@store.test",
    role: "requestor",
    department: "cleaning",
    allProjects: true,
  });
  ctx.store = await helpers.makeUser(ctx.company, {
    name: "Store Keeper",
    email: "store@store.test",
    role: "store",
    allProjects: true,
  });
  ctx.procurement = await helpers.makeUser(ctx.company, {
    name: "Buyer",
    email: "buy@store.test",
    role: "procurement",
    allProjects: true,
  });
});

after(async () => {
  await helpers.stopDb();
});

test("store issues partial stock, sends the shortage manually, and closes only when fully issued", async () => {
  const created = await as(ctx.requestor).post("/material-requests").send({
    projectId: ctx.project._id.toString(),
    departmentId: ctx.department._id.toString(),
    createdForId: ctx.requestor._id.toString(),
    products: [{ productId: "CLN-1", quantity: "10" }],
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const mrNo = created.body.materialRequest.id;

  const approved = await as(ctx.admin).put(`/material-requests/${mrNo}`).send({ status: "With Store" });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.materialRequest.status, "With Store");
  assert.equal(approved.body.materialRequest.storeOpen, true);
  assert.equal(approved.body.materialRequest.purchaseSent, false);

  const storeList = await as(ctx.store).get("/material-requests");
  assert.equal(storeList.status, 200, JSON.stringify(storeList.body));
  assert.ok(storeList.body.materialRequests.some((item) => item.id === mrNo));

  const autoPo = await as(ctx.procurement).put(`/material-requests/${mrNo}`).send({ status: "Sourcing" });
  assert.equal(autoPo.status, 403);

  const tooMuch = await as(ctx.store).post(`/material-requests/${mrNo}/issue`).send({
    lines: [{ productId: "CLN-1", quantity: 10 }],
  });
  assert.equal(tooMuch.status, 400);

  const partial = await as(ctx.store).post(`/material-requests/${mrNo}/issue`).send({
    lines: [{ productId: "CLN-1", quantity: 4 }],
  });
  assert.equal(partial.status, 200, JSON.stringify(partial.body));
  assert.equal(partial.body.materialRequest.status, "Partially Issued");
  assert.equal(partial.body.materialRequest.storeOpen, true);
  assert.equal(partial.body.materialRequest.purchaseSent, false);
  assert.equal(partial.body.materialRequest.products[0].issuedQty, 4);
  assert.equal(partial.body.materialRequest.products[0].pendingQty, 6);

  const stock = await Material.findOne({ _id: ctx.material._id, companyId: ctx.company._id });
  assert.equal(stock.stock, 0);

  const earlyClose = await as(ctx.admin).put(`/material-requests/${mrNo}`).send({ status: "Closed" });
  assert.equal(earlyClose.status, 400);

  const sent = await as(ctx.store).post(`/material-requests/${mrNo}/send-to-purchase`).send({});
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal(sent.body.materialRequest.status, "Sourcing");
  assert.equal(sent.body.materialRequest.storeOpen, true);
  assert.equal(sent.body.materialRequest.purchaseSent, true);
  assert.equal(sent.body.materialRequest.products[0].poQty, 6);
  assert.match(sent.body.message, /No purchase order was created/);

  const again = await as(ctx.store).post(`/material-requests/${mrNo}/send-to-purchase`).send({});
  assert.equal(again.status, 400);

  await Material.updateOne({ _id: ctx.material._id, companyId: ctx.company._id }, { stock: 6 });
  const rest = await as(ctx.store).post(`/material-requests/${mrNo}/issue`).send({
    lines: [{ productId: "CLN-1", quantity: 6 }],
  });
  assert.equal(rest.status, 200, JSON.stringify(rest.body));
  assert.equal(rest.body.materialRequest.status, "Closed");
  assert.equal(rest.body.materialRequest.storeOpen, false);
  assert.equal(rest.body.materialRequest.products[0].issuedQty, 10);
  assert.equal(rest.body.materialRequest.products[0].pendingQty, 0);
});
