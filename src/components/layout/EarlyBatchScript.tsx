import { screenBatchFor } from "@/lib/screenBatch";

/**
 * Inline script placed in the page's HTML: the moment the HTML arrives, before any JavaScript of the app has
 * downloaded (about two seconds on a phone), it sends the combined request for the screen in the address. The app picks
 * its answer up when it starts (`prefetch`), so the data is already there when the screen first draws.
 *
 * It does nothing for addresses that are not main screens, and any failure is ignored: the app then asks as usual.
 */
export function EarlyBatchScript() {
  const code = `(function(){try{var f=${screenBatchFor.toString()};var b=f(location.pathname);if(!b)return;var body=JSON.stringify(b.championship?{paths:b.paths,championship:b.championship}:{paths:b.paths});window.__earlyBatch={body:body,promise:fetch("/api/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:body}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
