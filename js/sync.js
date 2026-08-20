/* Live sync plumbing. The rules live in sync-state.js, which is kept free of
   storage and the DOM so it can be tested on its own; this file is the wiring.

   Optional throughout. If the module never loads, the network is gone, or no
   room is paired, everything here is inert and the app behaves exactly as it
   did before. This is a local app that can sync, not a sync app — a child in a
   car with no signal gets a full session either way. */

const Sync = (function () {
  const GAME = 'learn-letters';
  const ROOM_KEY = 'll.sync.room';   // per-device, deliberately never synced

  let handle = null;      // the kidsync instance, once it is up
  let pushing = false;    // set while we write, so we can ignore our own echo
  let applying = false;   // set while a remote record lands, to avoid a write loop
  let onChange = null;    // the app's repaint hook

  function knownRoom() {
    try { return localStorage.getItem(ROOM_KEY); } catch (e) { return null; }
  }

  function rememberRoom(code) {
    try { localStorage.setItem(ROOM_KEY, code); } catch (e) { /* private mode */ }
  }

  /** Publish local progress. Debounced inside kidsync, so calling this from
      every save is cheap. */
  function push() {
    if (!handle || applying) return;
    pushing = true;
    try { handle.set(Progress.syncSnapshot()); }
    catch (e) { /* offline writes queue inside the SDK */ }
    finally { pushing = false; }
  }

  /** kidsync's merge hook. Runs on the travelling subset, never on live state. */
  function merge(local, remote) {
    return SyncState.merge(local || {}, remote || {});
  }

  /** A merged record arrived from kidsync. Fold it in and repaint. */
  function apply(incoming) {
    if (pushing) return;                        // the echo of our own write
    if (!incoming || typeof incoming !== 'object') return;

    const room = handle && handle.roomCode;
    applying = true;
    try {
      /* Joining a room must never wipe a child's progress.

         resetEpoch only goes up, so a room where Reset progress has been used
         carries a higher number than a device that has never reset. Merging
         that in cold reads as a fresh reset and clears the joining device. On
         first contact the local epoch is lifted to meet the room's instead,
         which puts both sides level and makes the merge additive. A reset after
         that point is still higher, so it still wins. */
      if (room && knownRoom() !== room) {
        Progress.liftEpoch(incoming.resetEpoch);
        rememberRoom(room);
      }
      const changed = Progress.syncAdopt(incoming);
      if (changed && onChange) onChange();
    } catch (e) {
      /* A room holding something this app cannot read changes nothing here. */
    } finally {
      applying = false;
    }
  }

  function forgetRoom() {
    try { localStorage.removeItem(ROOM_KEY); } catch (e) { /* nothing to do */ }
  }

  function claimRoom(code) { rememberRoom(code); }

  function attach(instance) {
    handle = instance;
    if (onChange) onChange();
    instance.onStatusChange(function () { if (onChange) onChange(); });
  }

  return {
    game: GAME,
    attach: attach,
    push: push,
    merge: merge,
    apply: apply,
    forgetRoom: forgetRoom,
    claimRoom: claimRoom,
    initialState: function () { return Progress.syncSnapshot(); },
    handle: function () { return handle; },
    onRender: function (fn) { onChange = fn; }
  };
})();
