import { useEffect, useState } from 'react';
import { backupNow, enableBackup, getBackupConf, restoreBackup, type BackupConf } from '../lib/backup';
import { Btn, Card, CardHead, TextField, confirmAsk, toast } from './ui';

const when = (t?: number) =>
  t ? new Date(t).toLocaleString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'jamais';

/** Sauvegarde automatique chiffrée : activer, voir la dernière sauvegarde, sauvegarder maintenant. */
export function BackupCard() {
  const [conf, setConf] = useState<BackupConf | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState('');
  const [code2, setCode2] = useState('');
  const [access, setAccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const refresh = () => getBackupConf().then((c) => { setConf(c); setLoaded(true); });
  useEffect(() => { void refresh(); }, []);

  const enable = async () => {
    if (code.trim().length < 8) return setMsg('Choisis un code de sauvegarde d’au moins 8 caractères.');
    if (code.trim() !== code2.trim()) return setMsg('Les deux codes de sauvegarde ne sont pas identiques.');
    if (!access.trim()) return setMsg('Indique le code d’accès de ton serveur (le même que pour les rappels).');
    setBusy(true);
    setMsg('');
    try {
      await enableBackup(code, access);
      toast('Sauvegarde automatique activée');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;
  return (
    <Card tint="sky">
      <CardHead icon="upload" title="Sauvegarde automatique" />
      {conf ? (
        <>
          <p className="small">Activée. Tes données sont chiffrées sur ce téléphone avec ton code de sauvegarde, puis envoyées sur ton serveur après chaque changement (au plus toutes les 10 minutes) et quand tu quittes l’app.</p>
          <p className="small"><strong>Dernière sauvegarde :</strong> {when(conf.lastAt)}</p>
          {conf.lastError && <p className="small" style={{ color: 'var(--danger)' }}>Dernier essai échoué : {conf.lastError}</p>}
          <Btn small variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await backupNow(); toast('Sauvegardé'); } catch (e) { toast((e as Error).message); } finally { setBusy(false); void refresh(); } }}>Sauvegarder maintenant</Btn>
          <p className="tiny muted">Garde ton code de sauvegarde en lieu sûr : sans lui, personne (pas même toi) ne peut relire la sauvegarde. Les photos de recettes restent sur ce téléphone.</p>
        </>
      ) : (
        <>
          <p className="small">Si tu perds ou changes de téléphone, tu retrouves tout (recettes, planning, pesées, stock…) avec ton code de sauvegarde. Les données sont chiffrées sur ce téléphone avant l’envoi : ton serveur ne reçoit qu’un bloc illisible.</p>
          <TextField label="Code de sauvegarde (8 caractères minimum, à retenir)" value={code} onChange={setCode} />
          <TextField label="Le même code, une deuxième fois" value={code2} onChange={setCode2} />
          <TextField label="Code d’accès du serveur (celui des rappels)" value={access} onChange={setAccess} />
          {msg && <p className="small" role="alert" style={{ color: 'var(--danger)' }}>{msg}</p>}
          <Btn disabled={busy} onClick={enable}>{busy ? 'Activation…' : 'Activer la sauvegarde automatique'}</Btn>
        </>
      )}
    </Card>
  );
}

/** Restaurer la dernière sauvegarde (nouveau téléphone, données effacées…). */
export function RestoreCard({ onDone }: { onDone?: () => void }) {
  const [code, setCode] = useState('');
  const [access, setAccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const restore = async () => {
    if (!code.trim() || !access.trim()) return setMsg('Indique ton code de sauvegarde et le code d’accès du serveur.');
    if (!(await confirmAsk({ title: 'Remplacer les données de ce téléphone par ta sauvegarde ?', body: 'Les données actuelles de cet appareil seront remplacées par la dernière sauvegarde.', confirm: 'Restaurer ma sauvegarde', danger: true }))) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await restoreBackup(code, access);
      toast(`Sauvegarde du ${when(r.savedAt)} restaurée`);
      onDone?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHead icon="download" title="Restaurer ma sauvegarde" />
      <p className="small">Sur un nouveau téléphone : retrouve tout avec ton code de sauvegarde. La sauvegarde automatique reste active ensuite.</p>
      <TextField label="Code de sauvegarde" value={code} onChange={setCode} />
      <TextField label="Code d’accès du serveur" value={access} onChange={setAccess} />
      {msg && <p className="small" role="alert" style={{ color: 'var(--danger)' }}>{msg}</p>}
      <Btn variant="secondary" disabled={busy} onClick={restore}>{busy ? 'Restauration…' : 'Restaurer ma sauvegarde'}</Btn>
    </Card>
  );
}
