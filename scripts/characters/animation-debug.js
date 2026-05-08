const path = require('path');
const { CharacterBase } = require('./character-base');
const { CHARACTER_CONFIGS } = require('../shared/constants');

(async () => {
  const char = new CharacterBase(CHARACTER_CONFIGS.kalts, {
    app: null,
    modelsBasePath: path.join(__dirname, '..', '..', 'models'),
    startX: 0,
    startY: 0
  });

  await char.load();
  console.log('availableAnimations', char.availableAnimations);
  console.log('Resolve Relax_Idle ->', char.resolveAnimationName('Relax_Idle'));
  console.log('Resolve Relax ->', char.resolveAnimationName('Relax'));
  console.log('Resolve Sit ->', char.resolveAnimationName('Sit'));
  console.log('Resolve Move ->', char.resolveAnimationName('Move'));
  console.log('Resolve Interact ->', char.resolveAnimationName('Interact'));
  console.log('Resolve Sleep ->', char.resolveAnimationName('Sleep'));
})();
