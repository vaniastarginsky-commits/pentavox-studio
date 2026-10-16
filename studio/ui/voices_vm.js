export function voicesView(table) {
  return Array.from({ length: table.voiceCount }, (_, voice) => voice).map((voice) => {
    const banks = table.bankGroups(voice);
    const value = table.get(voice);
    const capability = table.capabilities(value.engine, voice);
    const dx7Bank = table.dx7BankFor(value.engine, voice);
    return {
      voice,
      title: `Plaits ${voice + 1}`,
      ...value,
      engineName: table.voiceLabels[voice][value.engine],
      banks,
      stereoEnabled: capability.stereo,
      syncEnabled: capability.sync,
      dx7Bank,
      dx7Path: dx7Bank ? `/DX7/BANK_${dx7Bank}.SYX` : null,
    };
  });
}

export function engineSetView(table) {
  const users = new Map();
  for (let voice = 0; voice < table.voiceCount; ++voice) {
    const engine = table.get(voice).engine;
    if (!users.has(engine)) users.set(engine, []);
    users.get(engine).push(voice + 1);
  }
  return table.bankGroups().map((bank) => ({
    bank: bank.bank,
    title: `Bank ${bank.bank}`,
    range: `slots ${bank.engines[0].slot}–${bank.engines.at(-1).slot}`,
    slots: bank.engines.map((engine) => ({
      ...engine,
      stereo: table.capabilities(engine.index).stereo,
      dx7Bank: table.dx7BankFor(engine.index),
      voices: users.get(engine.index) ?? [],
    })),
  }));
}
