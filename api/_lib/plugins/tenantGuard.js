/**
 * Every query on a tenant-owned model must filter by companyId.
 * Platform/migration code opts out explicitly with `.unscoped()`.
 */
const GUARDED_OPS = [
  "find",
  "findOne",
  "countDocuments",
  "distinct",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
];

function hasCompanyFilter(filter) {
  if (!filter || typeof filter !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(filter, "companyId") && filter.companyId !== undefined) return true;
  if (Array.isArray(filter.$and)) return filter.$and.some(hasCompanyFilter);
  return false;
}

function tenantGuard(schema) {
  schema.query.unscoped = function unscoped() {
    this._skipTenantGuard = true;
    return this;
  };

  schema.pre(GUARDED_OPS, function guard() {
    if (this._skipTenantGuard) return;
    if (hasCompanyFilter(this.getFilter())) return;
    const error = new Error(`Tenant guard: ${this.model.modelName}.${this.op} without companyId`);
    error.statusCode = 500;
    throw error;
  });

  schema.pre("aggregate", function guardAggregate() {
    if (this.options?.skipTenantGuard) return;
    const first = this.pipeline()[0];
    if (first?.$match && hasCompanyFilter(first.$match)) return;
    throw new Error(`Tenant guard: ${this._model?.modelName || "aggregate"} pipeline must start with $match on companyId`);
  });
}

module.exports = { tenantGuard, hasCompanyFilter };
