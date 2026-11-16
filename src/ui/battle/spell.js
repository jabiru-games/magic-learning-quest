// Aims the projectile from the caster's wand tip to the target's head, in arena coordinates.
export function aimSpell(root, reverse) {
  if (!root) return;
  const caster = reverse ? '.fighter-enemy' : '.fighter-player',
    target = reverse ? '.fighter-player' : '.fighter-enemy';
  const from = root.querySelector(`${caster} .pose-cast [data-wand-tip]`)?.getBoundingClientRect();
  const to = root.querySelector(`${target} .pose-idle .hit-target`)?.getBoundingClientRect();
  const box = root.getBoundingClientRect();
  if (!from || !to) return;
  const x = from.x + from.width / 2 - box.x,
    y = from.y + from.height / 2 - box.y,
    tx = to.x + to.width / 2 - box.x,
    ty = to.y + to.height / 2 - box.y;
  for (const [name, value] of Object.entries({ 'from-x': x, 'from-y': y, 'to-x': tx, 'to-y': ty }))
    root.style.setProperty(`--${name}`, `${value}px`);
  root.style.setProperty('--flight-angle', `${(Math.atan2(ty - y, tx - x) * 180) / Math.PI}deg`);
}
