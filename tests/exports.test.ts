describe('exports endpoints (REST)', () => {
  it('should export events CSV', async () => {
    const res = await fetch(`${baseUrl}/api/exports/events`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toContain('text/csv');

    const body = await res.text();
    expect(body).toContain('id,name,status,startDate,endDate');
  });

  it('should export invoices CSV', async () => {
    const res = await fetch(`${baseUrl}/api/exports/invoices`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toContain('text/csv');

    const body = await res.text();
    expect(body).toContain('invoiceNumber');
    expect(body).toContain('balancePaise');
  });

  it('should export vendors CSV', async () => {
    const res = await fetch(`${baseUrl}/api/exports/vendors`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toContain('text/csv');

    const body = await res.text();
    expect(body).toContain('id,name,type,phone,email,createdAt');
  });

  it('should return 401 for unauthenticated CSV export', async () => {
    const res = await fetch(`${baseUrl}/api/exports/events`, {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });
});
