import {compareVersions} from './distribution.mjs';

/** Only existing, inactive desktop apps are updated in place.
 * The W1 Central does not silently install a product the user never installed.
 */
export function shouldAutoUpdateInstalledProduct({
 enabled,installed,installedVersion,candidateVersion,running
}){
 if(!enabled||!installed||running||typeof candidateVersion!=='string')return false;
 if(!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(candidateVersion))return false;
 if(installedVersion===null||installedVersion===undefined)return true;
 if(typeof installedVersion!=='string')return false;
 return compareVersions(candidateVersion,installedVersion)>0;
}
