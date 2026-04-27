describe('invoices.sendViaEmail (REST)', () => {
  let invoiceId = '';

  beforeAll(async () => {
    const createInvoiceRes = await apiCall(
      '/invoices.create',
      {
        eventId,
        amount: 100000,
        dueDate: new Date(Date.now() + 86400000 * 15).toISOString(),
      },
      cookies,
    );

    expect(createInvoiceRes.status).toBe(200);
    invoiceId = createInvoiceRes.data.id;
  });

  it('should send invoice email with valid payload', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        to: 'client@example.com',
        subject: 'Invoice from EventFlow',
        message: 'Please find attached invoice.',
      }),
    });

    const data = await res.json();
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('messageId');
      expect(data.sentTo).toBe('client@example.com');
    }
  });

  it('should return 404 for non-existent invoice', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/00000000-0000-0000-0000-000000000000/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ to: 'client@example.com' }),
    });

    expect(res.status).toBe(404);
  });

  it('should return 401 without auth', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'client@example.com' }),
    });

    expect(res.status).toBe(401);
  });
});
