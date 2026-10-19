import { useState } from 'react';
import type { Aisle, DaySchedule, IngredientInfo, Unit, WeighState } from '../store/types';
import { flushSave, getData, mutate, resetAll, useApp, useData } from '../store/store';
import { DAY_NAMES, todayISO } from '../lib/dates';
import { AISLE_LABEL, AISLE_ORDER, formatEuro, ingredientKey, priceUnitLabel, STATE_LABEL } from '../lib/units';
import { migrate, randomId } from '../data/defaults';
import { go } from '../lib/router';
import { Btn, Card, CardHead, Icon, NumberField, Seg, TextField, Toggle, ToggleRow, confirmAsk, toast } from '../components/ui';
import { HydrationWidget } from '../components/hydration';

function LinkRow({ href, icon, label, hint }: { href: string; icon: string; label: string; hint?: string }) {
  return (
    <a className="link-row" href={href}>
      <Icon name={icon} />
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="tiny muted">{hint}</div>}
      </div>
      <Icon name="chevron" size={18} />
    </a>
  );
}

export function SettingsPage() {
  const d = useData((x) => x);
  const set = (fn: (x: typeof d) => void) => mutate(fn);
  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href="#/aujourdhui" aria-label="Retour"><Icon name="back" /></a>
        <h1 className="grow">Réglages</h1>
      </div>
      <Card>
        <LinkRow href="#/reglages/notifications" icon="bell" label="Notifications" hint={d.push.subscribed ? 'Rappels activés' : 'À configurer'} />
        <LinkRow href="#/reglages/iphone" icon="phone" label="Installer sur iPhone & activer les notifications" />
        <LinkRow href="#/reglages/horaires" icon="clock" label="Mes horaires" hint="Réveil, travail, coaching, repas, coucher" />
        <LinkRow href="#/alimentation?tab=recettes" icon="book" label="Mes recettes et portions" />
        <LinkRow href="#/reglages/ingredients" icon="euro" label="Ingrédients, rayons & prix" />
        <LinkRow href="#/alimentation?tab=stock" icon="fridge" label="Ce que j’ai déjà (stock)" />
        <LinkRow href="#/sport?tab=autorisations" icon="sport" label="Activités sportives autorisées" />
        <LinkRow href="#/hydratation" icon="drop" label="Hydratation" />
      </Card>

      <Card>
        <CardHead icon="heart" title="Mon profil" />
        <div className="grid2">
          <NumberField label="Taille" suffix="cm" value={d.profile.heightCm} min={120} max={220} onChange={(v) => v && set((x) => { x.profile.heightCm = v; })} />
          <NumberField label="Poids de départ" suffix="kg" value={d.profile.startWeightKg} min={30} max={250} onChange={(v) => v && set((x) => { x.profile.startWeightKg = v; })} />
          <NumberField label="Repère indicatif" suffix="kg" value={d.profile.targetWeightKg} min={30} max={250} onChange={(v) => v && set((x) => { x.profile.targetWeightKg = v; })} />
          <label className="field">Date indicative<input className="input" type="date" value={d.profile.targetDate} onChange={(e) => e.target.value && set((x) => { x.profile.targetDate = e.target.value; })} /></label>
        </div>
        <label className="field">Fin de la période de planification<input className="input" type="date" value={d.profile.planEnd} onChange={(e) => e.target.value && set((x) => { x.profile.planEnd = e.target.value; })} /></label>
        <p className="tiny muted">Ton poids actuel s’enregistre dans « Ma progression » (pesées).</p>
      </Card>

      <Card>
        <CardHead icon="food" title="Petit-déjeuner par défaut" />
        {d.breakfast.map((b, k) => (
          <div key={b.id} className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <div className="row">
              <input className="input grow" value={b.name} aria-label="Aliment" onChange={(e) => set((x) => { x.breakfast[k].name = e.target.value; })} />
              <button className="icon-btn plain" aria-label="Retirer" onClick={() => set((x) => { x.breakfast.splice(k, 1); })}><Icon name="trash" size={18} /></button>
            </div>
            <div className="row">
              <div style={{ width: 100 }}><NumberField value={b.qty} min={0} onChange={(v) => set((x) => { x.breakfast[k].qty = v ?? 0; })} /></div>
              <select className="input sm" style={{ width: 84 }} value={b.unit} onChange={(e) => set((x) => { x.breakfast[k].unit = e.target.value as Unit; })} aria-label="Unité">{(['g', 'ml', 'pièce'] as Unit[]).map((u) => <option key={u}>{u}</option>)}</select>
              <select className="input sm grow" value={b.state} onChange={(e) => set((x) => { x.breakfast[k].state = e.target.value as WeighState; })} aria-label="État">{(['', 'sec', 'comestible', 'cru', 'cuit', 'égoutté'] as WeighState[]).map((s) => <option key={s} value={s}>{s ? STATE_LABEL[s] : '—'}</option>)}</select>
            </div>
            <input className="input sm" placeholder="Précision (ex. pesé sec)" value={b.hint} onChange={(e) => set((x) => { x.breakfast[k].hint = e.target.value; })} />
          </div>
        ))}
        <Btn small variant="secondary" icon="plus" onClick={() => set((x) => { x.breakfast.push({ id: randomId(), name: '', qty: 0, unit: 'g', state: '', hint: '' }); })}>Ajouter un aliment</Btn>
        <ToggleRow label="Portions confirmées" help="Sinon elles restent marquées « provisoire »." checked={!!d.confirmed.breakfast} onChange={(v) => set((x) => { x.confirmed.breakfast = v; })} />
      </Card>

      <Card>
        <CardHead icon="cart" title="Budget, courses & batch" />
        <NumberField label="Budget alimentaire par semaine" suffix="€" value={d.weeklyBudget} min={0} onChange={(v) => v != null && set((x) => { x.weeklyBudget = v; })} />
        <label className="field">Samedi soir
          <select className="input" value={d.saturdayDinner} onChange={(e) => set((x) => { x.saturdayDinner = e.target.value as typeof d.saturdayDinner; })}>
            <option value="restaurant">Restaurant</option>
            <option value="free">Repas libre</option>
            <option value="planned">Repas planifié</option>
          </select>
        </label>
        <div className="grid2">
          <NumberField label="Frigo : plats cuisinés max" suffix="jours" value={d.maxFridgeDays} min={1} max={4} onChange={(v) => v && set((x) => { x.maxFridgeDays = v; })} />
          <label className="field">Début du batch (dimanche)<input className="input" type="time" value={d.batchStart} onChange={(e) => e.target.value && set((x) => { x.batchStart = e.target.value; })} /></label>
        </div>
        <p className="tiny muted">Au-delà de la durée frigo, les portions du batch sont prévues au congélateur (avec rappel de décongélation la veille). Ces réglages s’appliquent aux semaines générées ensuite.</p>
      </Card>

      <Card>
        <CardHead icon="scale" title="Pesée" />
        <label className="field">Jour de pesée
          <select className="input" value={d.weighDay} onChange={(e) => set((x) => { x.weighDay = Number(e.target.value); })}>{DAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        </label>
        <ToggleRow label="Proposer la pesée hebdomadaire" help="Désactive-la si elle devient stressante." checked={d.weighReminders} onChange={(v) => set((x) => { x.weighReminders = v; })} />
        <ToggleRow label="Masquer les chiffres de poids sur l’accueil" checked={d.profile.hideWeightOnHome} onChange={(v) => set((x) => { x.profile.hideWeightOnHome = v; })} />
      </Card>

      <Card>
        <CardHead icon="sparkle" title="Affichage" />
        <label className="field">Liquides
          <select className="input" value={d.liquidDisplay} onChange={(e) => set((x) => { x.liquidDisplay = e.target.value as 'ml' | 'auto'; })}>
            <option value="auto">ml, puis L au-delà de 1 000 ml</option>
            <option value="ml">Toujours en ml</option>
          </select>
        </label>
        <p className="tiny muted">Unités : kilogrammes, grammes, millilitres et litres · euro (€) · fuseau Europe/Brussels.</p>
      </Card>

      <Card>
        <LinkRow href="#/reglages/donnees" icon="download" label="Mes données : exporter, importer, réinitialiser" />
        <button className="link-row" onClick={() => { mutate((x) => { x.onboardingDone = false; }); go('/bienvenue'); }}>
          <Icon name="leaf" /><div className="grow">Refaire la configuration de départ</div><Icon name="chevron" size={18} />
        </button>
      </Card>
      <p className="tiny muted" style={{ textAlign: 'center' }}>Mange bien ! · données stockées uniquement sur cet appareil</p>
    </div>
  );
}

const TIME = (label: string, value: string | undefined, on: (v: string) => void) => (
  <label className="field">{label}<input className="input" type="time" value={value ?? ''} onChange={(e) => e.target.value && on(e.target.value)} /></label>
);

export function DayScheduleEditor({ s, onChange }: { s: DaySchedule; onChange: (fn: (x: DaySchedule) => void) => void }) {
  return (
    <div className="col">
      <div className="grid2">
        {TIME('Réveil', s.wake, (v) => onChange((x) => { x.wake = v; }))}
        {TIME('Coucher', s.bed, (v) => onChange((x) => { x.bed = v; }))}
        {TIME('Déjeuner', s.lunch, (v) => onChange((x) => { x.lunch = v; }))}
        {TIME('Dîner', s.dinner, (v) => onChange((x) => { x.dinner = v; }))}
      </div>
      <div className="row between"><span>Travail</span><Toggle label="Jour de travail" checked={!!s.work} onChange={(v) => onChange((x) => { x.work = v ? { start: '08:30', end: '17:00' } : undefined; })} /></div>
      {s.work && <div className="grid2">{TIME('Début', s.work.start, (v) => onChange((x) => { x.work!.start = v; }))}{TIME('Fin', s.work.end, (v) => onChange((x) => { x.work!.end = v; }))}</div>}
      <div className="row between"><span>Coaching (engagement pro)</span><Toggle label="Coaching" checked={!!s.coaching} onChange={(v) => onChange((x) => { x.coaching = v ? { start: '18:30', end: '20:30' } : undefined; })} /></div>
      {s.coaching && <div className="grid2">{TIME('Début', s.coaching.start, (v) => onChange((x) => { x.coaching!.start = v; }))}{TIME('Fin', s.coaching.end, (v) => onChange((x) => { x.coaching!.end = v; }))}</div>}
      <div className="row between"><span>Collation facultative</span><Toggle label="Collation" checked={!!s.snack} onChange={(v) => onChange((x) => { x.snack = v ? '16:30' : undefined; })} /></div>
      {s.snack && TIME('Heure de la collation', s.snack, (v) => onChange((x) => { x.snack = v; }))}
      <input className="input sm" placeholder="Note" value={s.note} onChange={(e) => onChange((x) => { x.note = e.target.value; })} aria-label="Note du jour" />
    </div>
  );
}

export function SchedulePage() {
  const schedule = useData((d) => d.schedule);
  const [day, setDay] = useState(0);
  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href="#/reglages" aria-label="Retour"><Icon name="back" /></a>
        <h1 className="grow">Mes horaires</h1>
      </div>
      <Seg label="Jour" value={String(day)} options={DAY_NAMES.map((n, i) => ({ value: String(i), label: n.slice(0, 3) }))} onChange={(v) => setDay(Number(v))} />
      <Card>
        <h2 className="cap">{DAY_NAMES[day]}</h2>
        <DayScheduleEditor s={schedule[day]} onChange={(fn) => mutate((d) => { fn(d.schedule[day]); d.confirmed.schedule = true; })} />
      </Card>
      <p className="small muted">Les heures de repas, de rappel et de décongélation s’adaptent automatiquement. Les collations ne sont ajoutées qu’aux semaines générées ensuite.</p>
    </div>
  );
}

export function IngredientsPage() {
  const catalog = useData((d) => d.ingredients);
  const recipes = useData((d) => d.recipes);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const unitOf = (k: string): Unit => {
    for (const r of recipes) for (const i of r.ingredients) if (ingredientKey(i.name) === k) return i.unit;
    for (const b of getData().breakfast) if (ingredientKey(b.name) === k) return b.unit;
    return 'g';
  };
  const keys = Object.keys(catalog).filter((k) => !q || k.includes(ingredientKey(q))).sort((a, b) => a.localeCompare(b, 'fr'));
  const setInfo = (k: string, p: Partial<IngredientInfo>) => mutate((d) => { d.ingredients[k] = { ...d.ingredients[k], ...p }; });
  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href="#/reglages" aria-label="Retour"><Icon name="back" /></a>
        <h1 className="grow">Ingrédients & prix</h1>
      </div>
      <Card tint="warn"><p className="small">Les prix de départ sont des <strong>estimations indicatives</strong>, pas des prix de marché vérifiés. Remplace-les par tes prix réels (ou utilise « Mettre à jour mes prix » après tes courses).</p></Card>
      <input className="input" type="search" placeholder="Chercher un ingrédient" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card>
        {keys.map((k) => {
          const i = catalog[k];
          const u = unitOf(k);
          return (
            <div key={k} className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div className="row between"><strong>{i.name}</strong>{i.price != null && <span className="tiny muted">{formatEuro(i.price)} {priceUnitLabel(u).replace('€', '')}</span>}</div>
              <div className="row">
                <select className="input sm grow" value={i.aisle} onChange={(e) => setInfo(k, { aisle: e.target.value as Aisle })} aria-label={`Rayon de ${i.name}`}>{AISLE_ORDER.map((a) => <option key={a} value={a}>{AISLE_LABEL[a]}</option>)}</select>
                <div style={{ width: 130 }}><NumberField value={i.price} min={0} suffix={priceUnitLabel(u)} onChange={(v) => setInfo(k, { price: v })} /></div>
              </div>
              <div className="row tiny muted">
                <div style={{ width: 120 }}><NumberField value={i.kcal} min={0} suffix={u === 'pièce' ? 'kcal/pc' : 'kcal/100'} onChange={(v) => setInfo(k, { kcal: v })} /></div>
                <div style={{ width: 120 }}><NumberField value={i.protein} min={0} suffix={u === 'pièce' ? 'g prot/pc' : 'g prot/100'} onChange={(v) => setInfo(k, { protein: v })} /></div>
              </div>
            </div>
          );
        })}
      </Card>
      <Card>
        <TextField label="Nouvel ingrédient" value={newName} onChange={setNewName} />
        <Btn variant="secondary" disabled={!newName.trim()} onClick={() => { const k = ingredientKey(newName); if (catalog[k]) return toast('Cet ingrédient existe déjà'); mutate((d) => { d.ingredients[k] = { name: newName.trim(), aisle: 'autres' }; }); setNewName(''); setQ(newName); }}>Ajouter</Btn>
      </Card>
    </div>
  );
}

export function DataPage() {
  const replaceAll = useApp((s) => s.replaceAll);
  const exportData = async () => {
    await flushSave();
    const json = JSON.stringify(getData(), null, 2);
    const name = `mange-bien-${todayISO()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Export Mange bien !' });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  return (
    <div className="page">
      <div className="topbar">
        <a className="icon-btn" href="#/reglages" aria-label="Retour"><Icon name="back" /></a>
        <h1 className="grow">Mes données</h1>
      </div>
      <Card>
        <CardHead icon="info" title="Confidentialité" />
        <p className="small">Tes recettes, repas, pesées, douleurs et réglages sont stockés <strong>uniquement sur cet appareil</strong> (IndexedDB). Ils ne sont envoyés nulle part.</p>
        <p className="small">Si tu actives les rappels app fermée, seuls l’adresse technique de notification de l’appareil et le texte + l’heure des rappels des 21 prochains jours sont envoyés à ton serveur (mode discret possible). Aucun poids ni donnée de santé.</p>
      </Card>
      <Card>
        <CardHead icon="download" title="Exporter" />
        <p className="small">Un fichier JSON avec toutes tes données (hors photos), à garder en sauvegarde (Fichiers, iCloud Drive…).</p>
        <Btn icon="download" onClick={exportData}>Exporter mes données</Btn>
      </Card>
      <Card>
        <CardHead icon="upload" title="Importer une sauvegarde" />
        <label className="btn secondary">
          <Icon name="upload" />Choisir un fichier
          <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const raw = JSON.parse(await f.text());
              if (!raw || typeof raw !== 'object' || !Array.isArray(raw.recipes)) throw new Error();
              if (!confirmAsk('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
              const d = migrate(raw);
              d.push = { ...getData().push };
              replaceAll(d);
              toast('Sauvegarde importée');
            } catch {
              toast('Fichier invalide : ce n’est pas une sauvegarde Mange bien !');
            }
          }} />
        </label>
      </Card>
      <Card tint="danger">
        <CardHead icon="trash" title="Réinitialiser" />
        <p className="small">Efface toutes les données de test ou personnelles de cet appareil et recharge les recettes de départ. Exporte d’abord si tu veux garder quelque chose.</p>
        <Btn variant="danger" onClick={async () => { if (confirmAsk('Tout effacer et repartir de zéro ?')) { await resetAll(); go('/bienvenue'); toast('Données réinitialisées'); } }}>Réinitialiser l’application</Btn>
      </Card>
    </div>
  );
}

export function HydrationPage() {
  const h = useData((d) => d.hydration);
  const today = todayISO();
  const log = h.log[today] ?? [];
  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={() => history.back()} aria-label="Retour"><Icon name="back" /></button>
        <h1 className="grow">Mon hydratation</h1>
      </div>
      <HydrationWidget />
      <Card>
        <CardHead icon="list" title="Aujourd’hui" />
        {log.length ? (
          <div className="list">{log.map((x, k) => <div key={k} className="list-item"><span className="grow">{new Date(x.t).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })}</span><strong>{x.ml} ml</strong></div>)}</div>
        ) : <p className="small muted">Rien de noté aujourd’hui. Le compteur repart à zéro chaque jour.</p>}
      </Card>
      <Card>
        <CardHead icon="drop" title="Mon repère" />
        <NumberField label="Repère journalier" suffix="ml" value={h.goalMl} min={500} max={5000} onChange={(v) => v && mutate((d) => { d.hydration.goalMl = v; })} />
        <p className="tiny muted">C’est un repère personnel, pas une prescription médicale : adapte-le à ta soif, à la chaleur, à ton activité et aux éventuelles recommandations de ton médecin.</p>
        <ToggleRow label="Garder l’historique" checked={h.keepHistory} onChange={(v) => mutate((d) => { d.hydration.keepHistory = v; })} />
        <a className="small" href="#/reglages/notifications">Heures des rappels d’hydratation</a>
      </Card>
    </div>
  );
}
