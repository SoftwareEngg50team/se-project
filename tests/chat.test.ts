describe('chat.respond', () => {
  it('should return help message', async () => {
    const { status, data } = await apiCall('/chat.respond', { message: 'help' }, cookies);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.intent).toBe('help');
    expect(typeof data.reply).toBe('string');
    expect(data.reply.length).toBeGreaterThan(10);
  });

  it('should return dashboard summary intent', async () => {
    const { status, data } = await apiCall('/chat.respond', { message: 'show dashboard summary' }, cookies);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.intent).toBe('summary');
    expect(data).toHaveProperty('navigationPath');
  });

  it('should return unknown intent for unsupported text', async () => {
    const { status, data } = await apiCall('/chat.respond', { message: 'random unsupported sentence' }, cookies);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.intent).toBe('unknown');
  });

  it('should reject empty message', async () => {
    const { status } = await apiCall('/chat.respond', { message: '' }, cookies);
    expect(status).toBe(400);
  });

  it('should return 401 for unauthenticated request', async () => {
    const { status } = await apiCall('/chat.respond', { message: 'help' }, {});
    expect(status).toBe(401);
  });
});
