export default function configureKarma(config) {
  config.set({
    browsers: ['ChromeHeadless'],
    reporters: ['progress', 'kjhtml'],
    restartOnFileChange: true,
    client: { clearContext: false },
  });
}
