describe('profile.getMine', () => {
  it('should return current user profile with payment settings', async () => {
    const { status, data } = await apiCall('/profile.getMine', {}, cookies);

    expect(status).toBe(200);
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('profile');
    expect(data).toHaveProperty('paymentSettings');
    expect(data.user).toHaveProperty('id');
    expect(data.user).toHaveProperty('email');
  });

  it('should return 401 without auth cookie', async () => {
    const { status } = await apiCall('/profile.getMine', {}, {});
    expect(status).toBe(401);
  });
});

describe('profile.updateMine', () => {
  it('should update profile basic fields', async () => {
    const { status, data } = await apiCall(
      '/profile.updateMine',
      {
        name: 'Integration Test User',
        phone: '+919900001111',
        title: 'Event Manager',
        city: 'Lahore',
        country: 'Pakistan',
      },
      cookies,
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should validate required name', async () => {
    const { status } = await apiCall(
      '/profile.updateMine',
      {
        name: 'A',
      },
      cookies,
    );

    expect(status).toBe(400);
  });
});

describe('profile.updatePaymentSettings', () => {
  it('should save payment settings used by invoices', async () => {
    const { status, data } = await apiCall(
      '/profile.updatePaymentSettings',
      {
        invoiceBrandColor: '#0ea5e9',
        billingAddress: '123 Event Street',
        billingEmail: 'billing@test.com',
        billingPhone: '+923001112233',
        taxId: 'GST1234',
        upiId: 'eventflow@upi',
        upiName: 'EventFlow Ops',
        bankName: 'HBL',
        bankAccountName: 'EventFlow',
        bankAccountNumber: '1234567890',
        bankIfsc: 'HBL0001',
        paymentTerms: 'Net 30',
        paymentNotes: 'Include invoice number in transfer note',
      },
      cookies,
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });
});
