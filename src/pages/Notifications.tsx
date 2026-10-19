import { useEffect, useMemo, useState } from 'react';
import type { NotifCategory, NotifRule } from '../store/types';
import { mutate, useData } from '../store/store';
import { capabilities, requestPermission, sendServerTest, serverAvailable, showLocal, subscribePush, syncReminders, unsubscribePush, upcomingReminders } from '../lib/push';
import { CATEGORY_INFO } from '../lib/reminders';
import { DAY_NAMES, formatHHMM, formatShort, todayISO } from '../lib/dates';
import { Btn, Card, CardHead, Icon, NumberField, Toggle, toast } from '../components/ui';

const GROUPS = ['Repas', 'Préparation', 'Sport et récupération', 'Suivi'] as const;

function RuleEditor({ cat }: { cat: NotifCategory }) {
  const rule = useData((d) => d.notif.rules[cat]);
  const info = CATEGORY_INFO[cat];
  const set = (p: Partial<NotifRule>) => mutate((d) => { d.notif.rules[cat] = { ...d.notif.rules[cat], ...p }; });
  return (
    <div className="col" style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
      <div className="row">
        <div className="grow">
          <div>{info.label}</div>
          <div className="tiny muted">{info.help}</div>
        </div>
        <Toggle label={info.label} checked={rule.enabled} onChange={(v) => set({ enabled: v })} />
      </div>
      {rule.enabled && (
        <div className="row wrap">
          {rule.day != null && (
            <select className="input sm" style={{ width: 'auto' }} value={rule.day} onChange={(e) => set({ day: Number(e.target.value) })} aria-label="Jour">
              {DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          )}
          {rule.time != null && <input className="input sm" style={{ width: 120 }} type="time" value={rule.time} onChange={(e) => e.target.value && set({ time: e.target.value })} aria-label="Heure" />}
          {rule.offsetMin != null && (
            <div style={{ width: 150 }}><NumberField value={rule.offsetMin} min={0} max={240} suffix="min" onChange={(v) => set({ offsetMin: v ?? 0 })} /></div>
          )}
          {rule.times && (
            <div className="row wrap">
              {rule.times.map((t, k) => (
                <div key={k} className="row" style={{ gap: 2 }}>
                  <input className="input sm" style={{ width: 110 }} type="time" value={t} onChange={(e) => e.target.value && set({ times: rule.times!.map((x, j) => (j === k ? e.target.value : x)) })} aria-label="Heure de rappel" />
                  <button className="icon-btn plain" aria-label="Retirer cette heure" onClick={() => set({ times: rule.times!.filter((_, j) => j !== k) })}><Icon name="x" size={16} /></button>
                </div>
              ))}
              <Btn small variant="ghost" icon="plus" onClick={() => set({ times: [...(rule.times ?? []), '16:00'] })}>Heure</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const data = useData((d) => d);
  const [caps, setCaps] = useState(capabilities);
  const [server, setServer] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    serverAvailable().then(setServer);
  }, []);
  const preview = useMemo(() => upcomingReminders(3).slice(0, 12), [data]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
      setCaps(capabilities());
    }
  };
  const iosNeedsInstall = caps.ios && !caps.standalone;

  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href="#/reglages" aria-label="Retour"><Icon name="back" /></a>
        <h1 className="grow">Notifications</h1>
      </div>

      <Card>
        <CardHead icon="info" title="État sur cet appareil" />
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Notifications web : {caps.notifications ? 'prises en charge' : 'non disponibles ici'}</li>
          <li>Permission : <strong>{caps.permission === 'granted' ? 'accordée' : caps.permission === 'denied' ? 'refusée' : caps.permission === 'default' ? 'pas encore demandée' : 'indisponible'}</strong></li>
          <li>Notifications push : {caps.push ? 'prises en charge' : 'non disponibles ici'}</li>
          <li>Installée sur l’écran d’accueil : {caps.standalone ? 'oui' : 'non'}</li>
          <li>Serveur de rappels : {server == null ? 'vérification…' : server ? 'joignable' : 'injoignable (rappels uniquement app ouverte)'}</li>
          <li>Rappels app fermée : <strong>{data.push.subscribed ? 'activés' : 'désactivés'}</strong>{data.push.lastSync && ` · synchronisés le ${new Date(data.push.lastSync).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' })}`}{data.push.syncedUntil && ` jusqu’au ${formatShort(data.push.syncedUntil)}`}</li>
        </ul>
        {data.push.lastError && <div className="alert-banner">Dernière erreur : {data.push.lastError}</div>}
        {iosNeedsInstall && (
          <div className="alert-banner">Sur iPhone, les notifications ne fonctionnent qu’une fois l’app ajoutée à l’écran d’accueil et ouverte depuis son icône. <a href="#/reglages/iphone">Voir comment faire</a></div>
        )}
        {caps.permission === 'denied' && <div className="alert-banner">Les notifications ont été refusées. Sur iPhone : Réglages → Notifications → Manges bien ! → Autoriser. L’application continue de fonctionner normalement sans elles.</div>}
      </Card>

      <Card tint="sage">
        <CardHead icon="bell" title="1. Autoriser" />
        <Btn disabled={busy || !caps.notifications || caps.permission === 'granted'} onClick={() => run(async () => { const p = await requestPermission(); if (p !== 'granted') throw new Error('Permission non accordée'); }, 'Notifications autorisées')}>
          {caps.permission === 'granted' ? 'Autorisées ✓' : 'Autoriser les notifications'}
        </Btn>
        <p className="tiny muted">Sans l’étape 2, les rappels ne s’affichent que lorsque l’application est ouverte.</p>
      </Card>

      <Card tint="sage">
        <CardHead icon="bell" title="2. Rappels même app fermée" />
        {data.push.subscribed ? (
          <>
            <p className="small">Le serveur garde tes rappels des 21 prochains jours et les envoie à l’heure prévue. La liste est mise à jour à chaque modification et à chaque ouverture de l’app.</p>
            <div className="row wrap">
              <Btn small variant="secondary" disabled={busy} onClick={() => run(syncReminders, 'Rappels synchronisés')}>Synchroniser maintenant</Btn>
              <Btn small variant="ghost" disabled={busy} onClick={() => run(unsubscribePush, 'Rappels app fermée désactivés')}>Désactiver</Btn>
            </div>
            <p className="tiny muted">Si tu n’ouvres pas l’application pendant 3 semaines, les rappels s’arrêtent jusqu’à la prochaine ouverture.</p>
          </>
        ) : (
          <>
            <p className="small">Saisis une fois le code d’accès que tu as choisi lors du déploiement du serveur (il n’est pas enregistré dans l’app).</p>
            <input className="input" type="password" autoComplete="off" placeholder="Code d’accès du serveur" value={code} onChange={(e) => setCode(e.target.value)} />
            <Btn disabled={busy || !code || !caps.push} onClick={() => run(() => subscribePush(code), 'Rappels activés 🎉')}>Activer les rappels</Btn>
            {!caps.push && <p className="tiny muted">Push indisponible dans ce navigateur{caps.ios ? ' : ajoute l’app à l’écran d’accueil (iOS 16.4 ou plus récent).' : '.'}</p>}
          </>
        )}
      </Card>

      <Card>
        <CardHead icon="sparkle" title="Tester" />
        <div className="col">
          <Btn small variant="secondary" disabled={busy || caps.permission !== 'granted'} onClick={() => run(() => showLocal('Manges bien ! — test', 'Une notification locale, affichée par l’app ouverte.'), 'Notification locale envoyée')}>Notification locale immédiate</Btn>
          <Btn small variant="secondary" disabled={busy || !data.push.subscribed} onClick={() => run(() => sendServerTest(0), 'Demande envoyée au serveur')}>Push via le serveur, maintenant</Btn>
          <Btn small variant="secondary" disabled={busy || !data.push.subscribed} onClick={() => run(() => sendServerTest(90), 'Programmée dans ~2 min : ferme l’app pour vérifier')}>Push dans ~2 minutes (ferme l’app)</Btn>
        </div>
        <p className="tiny muted">Le dernier test est le seul qui prouve que les rappels arrivent app fermée sur ton iPhone.</p>
      </Card>

      <Card>
        <CardHead icon="moon" title="Calme et pause" />
        <div className="grid2">
          <label className="field">Pas de rappel après<input className="input" type="time" value={data.notif.quietStart} onChange={(e) => e.target.value && mutate((d) => { d.notif.quietStart = e.target.value; })} /></label>
          <label className="field">…ni avant<input className="input" type="time" value={data.notif.quietEnd} onChange={(e) => e.target.value && mutate((d) => { d.notif.quietEnd = e.target.value; })} /></label>
        </div>
        <label className="field">Suspendre tous les rappels jusqu’au (inclus)<input className="input" type="date" min={todayISO()} value={data.notif.pausedUntil ?? ''} onChange={(e) => mutate((d) => { d.notif.pausedUntil = e.target.value || undefined; })} /></label>
        {data.notif.pausedUntil && <Btn small variant="ghost" onClick={() => mutate((d) => { d.notif.pausedUntil = undefined; })}>Reprendre les rappels</Btn>}
        <div className="list-item">
          <div className="grow"><div>Messages discrets</div><div className="tiny muted">Les noms de repas ne sont pas envoyés au serveur ni affichés sur l’écran verrouillé.</div></div>
          <Toggle label="Messages discrets" checked={data.notif.discreet} onChange={(v) => mutate((d) => { d.notif.discreet = v; })} />
        </div>
        <p className="tiny muted">Le mode Concentration / Ne pas déranger de l’iPhone reste prioritaire sur ces réglages.</p>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g}>
          <h2>{g}</h2>
          {(Object.keys(CATEGORY_INFO) as NotifCategory[]).filter((c) => CATEGORY_INFO[c].group === g).map((c) => <RuleEditor key={c} cat={c} />)}
        </Card>
      ))}

      <Card>
        <CardHead icon="clock" title="Prochains rappels" />
        {preview.length ? (
          <div className="list">
            {preview.map((r) => (
              <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <span className="small strong nowrap">{formatShort(r.date)}<br />{formatHHMM(r.time)}</span>
                <div className="grow small"><strong>{r.title}</strong><div className="muted">{r.body}</div></div>
              </div>
            ))}
          </div>
        ) : <p className="small muted">Aucun rappel prévu dans les 3 prochains jours.</p>}
        <p className="tiny muted">Heures de Bruxelles ; le passage à l’heure d’été / d’hiver est pris en compte.</p>
      </Card>
    </div>
  );
}

export function IphoneHelpPage() {
  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href="#/reglages" aria-label="Retour"><Icon name="back" /></a>
        <h1 className="grow">Installer sur iPhone</h1>
      </div>
      <Card>
        <CardHead icon="phone" title="Ajouter Manges bien ! à l’écran d’accueil" />
        <ol className="steps-list small">
          <li>Ouvre l’adresse de l’application dans <strong>Safari</strong>.</li>
          <li>Touche le bouton <strong>Partager</strong> <Icon name="share" size={16} /> (en bas de l’écran, ou via le menu « ··· »).</li>
          <li>Choisis <strong>« Sur l’écran d’accueil »</strong>, puis vérifie que « Ouvrir en tant qu’app web » est activé si l’option apparaît, et touche <strong>Ajouter</strong>.</li>
          <li>Ferme Safari et ouvre <strong>Manges bien ! depuis sa nouvelle icône</strong>.</li>
        </ol>
      </Card>
      <Card>
        <CardHead icon="bell" title="Activer les notifications" />
        <ol className="steps-list small">
          <li>Il faut <strong>iOS 16.4 ou plus récent</strong> (Réglages → Général → Informations).</li>
          <li>Dans l’app installée : Réglages → Notifications → <strong>Autoriser les notifications</strong>, puis accepte la demande d’iOS.</li>
          <li>Saisis ton code d’accès et touche <strong>Activer les rappels</strong>.</li>
          <li>Fais le test « Push dans ~2 minutes », puis ferme l’app (balayage vers le haut) et attends la notification.</li>
          <li>Pour ajuster : Réglages iPhone → Notifications → Manges bien ! (sons, écran verrouillé, résumé programmé).</li>
        </ol>
      </Card>
      <Card tint="peach">
        <CardHead icon="info" title="Bon à savoir" />
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Les modes Concentration (Sommeil, Ne pas déranger…) peuvent retarder ou masquer les notifications.</li>
          <li>Tes données restent dans l’iPhone (stockage de l’app). L’app installée sur l’écran d’accueil n’est pas soumise à l’effacement automatique de Safari, mais pense à exporter tes données de temps en temps.</li>
          <li>Supprimer l’icône de l’écran d’accueil supprime aussi les données de l’app.</li>
          <li>Hors connexion, l’app reste consultable ; seuls la synchronisation des rappels et les tests serveur ont besoin du réseau.</li>
        </ul>
      </Card>
    </div>
  );
}
