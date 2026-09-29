import type {CapacitorConfig} from '@capacitor/cli';

const serverUrl=process.env.CAPACITOR_SERVER_URL || 'https://kalora-1fjs.vercel.app';

const config:CapacitorConfig={
 appId:'com.kalora.app',
 appName:'Kalora',
 webDir:'native-shell',
 server:{
  url:serverUrl,
  cleartext:false,
  allowNavigation:['kalora-1fjs.vercel.app']
 },
 ios:{
  contentInset:'automatic',
  preferredContentMode:'mobile'
 }
};

export default config;
