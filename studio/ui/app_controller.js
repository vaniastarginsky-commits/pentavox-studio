export async function rebootToDfu(client, readStatus, {
  intervalMs = 750,
  timeoutMs = 60_000,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onWaiting = () => {},
} = {}) {
  await client.reboot(1);
  onWaiting();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await readStatus();
    if (status.dfu) return status;
    await wait(intervalMs);
  }
  throw new Error('The DFU device did not appear within 60 seconds');
}
