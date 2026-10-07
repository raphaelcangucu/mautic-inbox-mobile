export type CustomTabsProviders={preferredBrowserPackage?:string;defaultBrowserPackage?:string;browserPackages:string[];servicePackages:string[]};

/** WebAPKs can claim a Mautic URL but cannot host the native OAuth session. */
export function customTabsBrowser(providers:CustomTabsProviders):string|undefined{
 const browsers=new Set(providers.browserPackages);
 const services=new Set(providers.servicePackages);
 return [providers.preferredBrowserPackage,providers.defaultBrowserPackage,...providers.browserPackages]
  .find((name):name is string=>!!name&&browsers.has(name)&&services.has(name));
}
