// Exact official pages. This integration opens the publisher's website;
 // never downloads or executes an unknown binary on behalf of a user.
export const OFFICIAL_TOOL_URLS=Object.freeze({
 opencode:'https://opencode.ai/desktop',
 warp:'https://developers.cloudflare.com/warp-client/get-started/windows/'
});
export function officialToolUrl(provider){
 if(typeof provider!=='string'||!Object.hasOwn(OFFICIAL_TOOL_URLS,provider))
  throw Error('Ferramenta oficial não autorizada.');
 return OFFICIAL_TOOL_URLS[provider];
}
