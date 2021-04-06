// Changing to a typescript file causes this dynamic import
// to not compile at all. Leaving as js for now :)

function onEnable () {
  // import('plugins/wolfram2desmos/wolfram2desmos.user.js')
}

export default {
  name: 'wolfram2desmos',
  description: 'Convert ASCIImath into Desmos LaTeX on paste.',
  onEnable: onEnable,
  enabledByDefault: true
}
