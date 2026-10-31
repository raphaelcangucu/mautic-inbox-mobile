module.exports=({config})=>{
 const environment=process.env.MAUTIC_APNS_ENVIRONMENT||'development';
 if(!['development','production'].includes(environment))throw new Error('Invalid MAUTIC_APNS_ENVIRONMENT');
 // End-to-end builds against the local HTTPS bench trust user-installed CAs; store builds never do.
 const plugins=process.env.MAUTIC_E2E_USER_CA==='1'?[...(config.plugins||[]),'./plugins/withE2EUserCa.cjs']:config.plugins;
 return {...config,plugins,ios:{...config.ios,entitlements:{...config.ios?.entitlements,'aps-environment':environment}},extra:{...config.extra,apnsEnvironment:environment}};
};
