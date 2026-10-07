import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, stopApp, TestContext } from './support/app';
import { buildWorld, createSupplier, expectOk, Json, listAll, uniq, World } from './support/world';

describe('Suppliers and customers', () => {
  let ctx: TestContext;
  let w: World;
  let foreign: World;

  beforeAll(async () => {
    ctx = await startApp();
    w = await buildWorld(ctx, 'Parties');
    foreign = await buildWorld(ctx, 'PartiesX');
  });
  afterAll(() => stopApp(ctx));

  describe('suppliers', () => {
    it('creates a supplier with Philippine tax data and audits it', async () => {
      const res = await w.admin.post('/v1/suppliers').send({
        code: uniq('SUP'), name: 'Holcim Philippines Inc.', tin: '000-123-456-000', vatStatus: 'VAT', paymentTermsDays: 45,
        category: 'Cement', ewtCode: 'WC158', email: 'sales@holcim.example', phone: '+63 2 8888 0000',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Holcim Philippines Inc.', paymentTermsDays: 45, active: true, accredited: false });
      const audit = await ctx.prisma.auditLog.findFirst({ where: { entityType: 'Supplier', entityId: res.body.id, action: 'CREATE' } });
      expect(audit?.companyId).toBe(w.company.id);
    });

    it('rejects invalid input with RFC 9457 field errors', async () => {
      const res = await w.admin.post('/v1/suppliers').send({ code: '', name: 'X', email: 'not-an-email', paymentTermsDays: 9999 });
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const paths = (res.body.errors as Array<{ path: string }>).map((e) => e.path);
      expect(paths).toEqual(expect.arrayContaining(['code', 'email', 'paymentTermsDays']));
    });

    it('rejects a duplicate code with 409', async () => {
      const code = uniq('DUP');
      await createSupplier(w.admin, code);
      const res = await w.admin.post('/v1/suppliers').send({ code, name: 'Again' });
      expect(res.status).toBe(409);
    });

    it('requires authentication and permission', async () => {
      expect((await ctx.http().get('/v1/suppliers')).status).toBe(401);
      expect((await w.viewer.get('/v1/suppliers')).status).toBe(403);
      expect((await w.viewer.post('/v1/suppliers').send({ code: 'Z', name: 'Z' })).status).toBe(403);
      const s = await createSupplier(w.admin);
      expect((await w.buyer.delete(`/v1/suppliers/${s.id}`)).status).toBe(403);
    });

    it('never exposes another company\'s suppliers', async () => {
      const theirs = await createSupplier(foreign.admin, uniq('THEIRS'));
      expect((await w.admin.get(`/v1/suppliers/${theirs.id}`)).status).toBe(404);
      expect((await w.admin.patch(`/v1/suppliers/${theirs.id}`).send({ name: 'Hijack' })).status).toBe(404);
      expect((await w.admin.get(`/v1/suppliers/${theirs.id}/performance`)).status).toBe(404);
      expect((await w.admin.get(`/v1/suppliers/${theirs.id}/contacts`)).status).toBe(404);
      const codes = (await listAll<{ code: string }>(w.admin, '/v1/suppliers')).map((s) => s.code);
      expect(codes).not.toContain(theirs.code);
    });

    it('lists with search, filters, sorting and cursor pagination', async () => {
      const tag = uniq('LST');
      for (const [i, name] of ['Alpha', 'Bravo', 'Charlie'].entries()) {
        await createSupplier(w.admin, `${tag}-${i}`, { name: `${tag} ${name}`, category: tag, ...(i === 0 ? {} : {}) });
      }
      const first = await w.admin.get('/v1/suppliers').query({ search: tag, limit: 2, sort: 'name:desc' });
      expect(first.status).toBe(200);
      expect(first.body.items.map((s: Json) => s.name)).toEqual([`${tag} Charlie`, `${tag} Bravo`]);
      expect(first.body.nextCursor).toBeTruthy();
      const second = await w.admin.get('/v1/suppliers').query({ search: tag, limit: 2, sort: 'name:desc', cursor: first.body.nextCursor });
      expect(second.body.items.map((s: Json) => s.name)).toEqual([`${tag} Alpha`]);
      expect(second.body.nextCursor).toBeNull();

      const byCategory = await w.admin.get('/v1/suppliers').query({ category: tag });
      expect(byCategory.body.items).toHaveLength(3);
      expect((await w.admin.get('/v1/suppliers').query({ sort: 'passwordHash:asc' })).status).toBe(400);
      expect((await w.admin.get('/v1/suppliers').query({ limit: 500 })).status).toBe(400);
    });

    it('a partial update changes only the fields sent', async () => {
      const s = await createSupplier(w.admin, uniq('PAT'), { paymentTermsDays: 45, vatStatus: 'NON_VAT', tin: '111' });
      const res = await w.admin.patch(`/v1/suppliers/${s.id}`).send({ name: 'Renamed Supplier' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Renamed Supplier', paymentTermsDays: 45, vatStatus: 'NON_VAT', tin: '111' });
    });

    it('accreditation needs a number, and revoking clears it', async () => {
      const s = await createSupplier(w.admin);
      expect((await w.admin.put(`/v1/suppliers/${s.id}/accreditation`).send({ accredited: true })).status).toBe(400);
      const ok = await w.admin.put(`/v1/suppliers/${s.id}/accreditation`).send({ accredited: true, accreditationNo: 'ACC-2026-001', accreditationExpiry: '2027-06-30' });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ accredited: true, accreditationNo: 'ACC-2026-001' });
      const filtered = await w.admin.get('/v1/suppliers').query({ accredited: 'true', search: s.code });
      expect(filtered.body.items).toHaveLength(1);
      const revoked = await w.admin.put(`/v1/suppliers/${s.id}/accreditation`).send({ accredited: false, notes: 'Lapsed' });
      expect(revoked.body).toMatchObject({ accredited: false, accreditationNo: null, accreditationExpiry: null });
    });

    it('manages contacts and keeps a single primary contact', async () => {
      const s = await createSupplier(w.admin);
      const a = await expectOk<Json>(await w.admin.post(`/v1/suppliers/${s.id}/contacts`).send({ name: 'Maria Santos', position: 'Sales', isPrimary: true }));
      const b = await expectOk<Json>(await w.admin.post(`/v1/suppliers/${s.id}/contacts`).send({ name: 'Jose Reyes', email: 'jose@example.com', isPrimary: true }));
      let list = await w.admin.get(`/v1/suppliers/${s.id}/contacts`);
      expect(list.body.filter((c: Json) => c.isPrimary)).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ id: b.id, isPrimary: true });
      expect((await w.admin.patch(`/v1/suppliers/${s.id}/contacts/${a.id}`).send({ phone: '0917 000 0000' })).status).toBe(200);
      expect((await w.admin.post(`/v1/suppliers/${s.id}/contacts`).send({ name: 'Bad', email: 'x' })).status).toBe(400);
      expect((await w.admin.delete(`/v1/suppliers/${s.id}/contacts/${a.id}`)).status).toBe(204);
      list = await w.admin.get(`/v1/suppliers/${s.id}/contacts`);
      expect(list.body).toHaveLength(1);
      expect((await w.admin.patch(`/v1/suppliers/${s.id}/contacts/${a.id}`).send({ name: 'Gone' })).status).toBe(404);
      const detail = await w.admin.get(`/v1/suppliers/${s.id}`);
      expect(detail.body.contacts).toHaveLength(1);
    });

    it('records evaluations and derives performance from them (null where no documents exist)', async () => {
      const s = await createSupplier(w.admin);
      const empty = await w.admin.get(`/v1/suppliers/${s.id}/performance`);
      expect(empty.status).toBe(200);
      expect(empty.body.orders).toMatchObject({ count: 0, totalValue: '0.00', openCount: 0, lastOrderDate: null });
      expect(empty.body.delivery.onTimeRatePct).toBeNull();
      expect(empty.body.quality.rejectionRatePct).toBeNull();
      expect(empty.body.evaluations).toMatchObject({ count: 0, averages: null });
      expect(empty.body.sourcing.responseRatePct).toBeNull();

      const bad = await w.admin.post(`/v1/suppliers/${s.id}/evaluations`).send({
        periodStart: '2026-01-01', periodEnd: '2026-03-31', priceScore: 101, qualityScore: 80, deliveryScore: 80, responsivenessScore: 80, complianceScore: 80,
      });
      expect(bad.status).toBe(400);
      expect((await w.admin.post(`/v1/suppliers/${s.id}/evaluations`).send({
        periodStart: '2026-04-01', periodEnd: '2026-03-31', priceScore: 80, qualityScore: 80, deliveryScore: 80, responsivenessScore: 80, complianceScore: 80,
      })).status).toBe(400);

      for (const score of [80, 90]) {
        const ok = await w.admin.post(`/v1/suppliers/${s.id}/evaluations`).send({
          periodStart: '2026-01-01', periodEnd: '2026-03-31', priceScore: score, qualityScore: score, deliveryScore: score,
          responsivenessScore: score, complianceScore: score, rejectionRatePct: '1.5', notes: 'Quarterly review',
        });
        expect(ok.status).toBe(201);
      }
      const perf = await w.admin.get(`/v1/suppliers/${s.id}/performance`);
      expect(perf.body.evaluations.count).toBe(2);
      expect(perf.body.evaluations.averages).toMatchObject({ price: '85.00', overall: '85.00' });
      const list = await w.admin.get(`/v1/suppliers/${s.id}/evaluations`);
      expect(list.body.items).toHaveLength(2);
    });

    it('shows an empty purchase history for a new supplier', async () => {
      const s = await createSupplier(w.admin);
      const res = await w.admin.get(`/v1/suppliers/${s.id}/purchase-history`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('deletes unused suppliers (soft) and exposes an ordered activity timeline with actor names', async () => {
      const s = await createSupplier(w.admin);
      await w.admin.patch(`/v1/suppliers/${s.id}`).send({ phone: '123' });
      await w.pm.get(`/v1/suppliers/${s.id}`);
      const activity = await w.admin.get(`/v1/suppliers/${s.id}/activity`);
      expect(activity.status).toBe(200);
      expect(activity.body.map((a: { action: string }) => a.action)).toEqual(['CREATE', 'UPDATE']);
      expect(activity.body[0].actor.name).toBe('Test User');
      expect(activity.body[1].details.changedFields).toContain('phone');
      expect(new Date(activity.body[0].at).getTime()).toBeLessThanOrEqual(new Date(activity.body[1].at).getTime());

      expect((await w.admin.delete(`/v1/suppliers/${s.id}`)).status).toBe(204);
      expect((await w.admin.get(`/v1/suppliers/${s.id}`)).status).toBe(404);
      const row = await ctx.prisma.supplier.findUniqueOrThrow({ where: { id: s.id } });
      expect(row.deletedAt).not.toBeNull();
    });
  });

  describe('customers', () => {
    it('creates, lists, updates and audits a customer', async () => {
      const code = uniq('CUS');
      const created = await w.admin.post('/v1/customers').send({ code, name: 'Ayala Land Inc.', tin: '000-111-222-000', creditLimit: '5000000.50', paymentTermsDays: 60 });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ creditLimit: '5000000.5', paymentTermsDays: 60, vatStatus: 'VAT', isCompany: true });
      const patched = await w.admin.patch(`/v1/customers/${created.body.id}`).send({ phone: '+63 2 7777 1111' });
      expect(patched.body).toMatchObject({ phone: '+63 2 7777 1111', paymentTermsDays: 60, creditLimit: '5000000.5' });
      const list = await w.admin.get('/v1/customers').query({ search: 'Ayala' });
      expect(list.body.items.map((c: Json) => c.id)).toContain(created.body.id);
      const activity = await w.admin.get(`/v1/customers/${created.body.id}/activity`);
      expect(activity.body.map((a: { action: string }) => a.action)).toEqual(['CREATE', 'UPDATE']);
    });

    it('validates input, enforces unique codes and permissions', async () => {
      expect((await w.admin.post('/v1/customers').send({ code: 'A', name: '', creditLimit: '-5' })).status).toBe(400);
      const code = uniq('CDUP');
      await w.admin.post('/v1/customers').send({ code, name: 'One' });
      expect((await w.admin.post('/v1/customers').send({ code, name: 'Two' })).status).toBe(409);
      expect((await ctx.http().get('/v1/customers')).status).toBe(401);
      expect((await w.viewer.get('/v1/customers')).status).toBe(403);
    });

    it('is isolated by company', async () => {
      const theirs = await foreign.admin.post('/v1/customers').send({ code: uniq('FC'), name: 'Foreign Client' });
      expect((await w.admin.get(`/v1/customers/${theirs.body.id}`)).status).toBe(404);
      expect((await w.admin.delete(`/v1/customers/${theirs.body.id}`)).status).toBe(404);
    });

    it('keeps contacts and refuses to delete a customer that has projects', async () => {
      const contact = await w.admin.post(`/v1/customers/${w.customerId}/contacts`).send({ name: 'Ana Cruz', position: 'Project Owner Rep', isPrimary: true });
      expect(contact.status).toBe(201);
      const detail = await w.admin.get(`/v1/customers/${w.customerId}`);
      expect(detail.body.contacts).toHaveLength(1);
      expect(detail.body.projectCount).toBeGreaterThanOrEqual(1);
      const del = await w.admin.delete(`/v1/customers/${w.customerId}`);
      expect(del.status).toBe(422);

      const unused = await w.admin.post('/v1/customers').send({ code: uniq('CDEL'), name: 'Unused' });
      expect((await w.admin.delete(`/v1/customers/${unused.body.id}`)).status).toBe(204);
    });
  });
});
