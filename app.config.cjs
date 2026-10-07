module.exports=({config})=>{
 const environment=process.env.MAUTIC_APNS_ENVIRONMENT||'development';
 if(!['development','production'].includes(environment))throw new Error('Invalid MAUTIC_APNS_ENVIRONMENT');
 return {...config,ios:{...config.ios,entitlements:{...config.ios?.entitlements,'aps-environment':environment}},extra:{...config.extra,apnsEnvironment:environment}};
};
