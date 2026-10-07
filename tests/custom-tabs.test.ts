import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customTabsBrowser} from '../src/api/custom-tabs.ts';

test('installed Mautic web shortcut cannot capture native authentication',()=>{
 assert.equal(customTabsBrowser({defaultBrowserPackage:'org.chromium.webapk.mautic',browserPackages:['org.chromium.webapk.mautic','com.android.chrome'],servicePackages:['com.android.chrome']}),'com.android.chrome');
});
test('respects a preferred compatible browser rather than hardcoding Chrome',()=>{
 assert.equal(customTabsBrowser({preferredBrowserPackage:'org.mozilla.firefox',defaultBrowserPackage:'com.android.chrome',browserPackages:['com.android.chrome','org.mozilla.firefox'],servicePackages:['com.android.chrome','org.mozilla.firefox']}),'org.mozilla.firefox');
});
test('a service without a matching browser activity is not eligible',()=>{
 assert.equal(customTabsBrowser({preferredBrowserPackage:'hidden.provider',browserPackages:['org.chromium.webapk.mautic'],servicePackages:['hidden.provider']}),undefined);
});
test('no compatible browser requires the existing alternative login',()=>{
 assert.equal(customTabsBrowser({browserPackages:[],servicePackages:[]}),undefined);
});
