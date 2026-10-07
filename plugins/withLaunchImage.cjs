const {withMod} = require('expo/config-plugins');

// SDK 55 cannot insert an image into a previously image-less storyboard because
// <subviews/> parses as a string. Repair that view after Expo applies its assets.
// Register before expo-splash-screen, which installs the storyboard provider.
module.exports = config => withMod(config, {
  platform: 'ios',
  mod: 'splashScreenStoryboard',
  action: config => {
    const view = config.modResults.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
    if (!view.subviews?.[0] || typeof view.subviews[0] !== 'object') view.subviews = [{imageView: []}];
    const images = view.subviews[0].imageView ||= [];
    if (!images.some(image => image.$.id === 'EXPO-SplashScreen')) images.push({
      $: {id:'EXPO-SplashScreen',userLabel:'SplashScreenLogo',image:'SplashScreenLogo',contentMode:'scaleAspectFit',clipsSubviews:true,userInteractionEnabled:false,translatesAutoresizingMaskIntoConstraints:false},
      rect:[{$:{key:'frame',x:152.5,y:382,width:88,height:88}}],
    });
    return config;
  },
});
