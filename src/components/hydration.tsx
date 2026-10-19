import { useState } from 'react';
import { addWater, undoWater, useData } from '../store/store';
import { todayISO } from '../lib/dates';
import { formatQty } from '../lib/units';
import { Btn, Card, CardHead, NumberField, Ring } from './ui';

export function useWaterToday(date = todayISO()) {
  return useData((d) => (d.hydration.log[date] ?? []).reduce((s, x) => s + x.ml, 0));
}

export function HydrationWidget({ compact }: { compact?: boolean }) {
  const goal = useData((d) => d.hydration.goalMl);
  const total = useWaterToday();
  const [custom, setCustom] = useState<number | undefined>();
  const reached = total >= goal;
  return (
    <Card tint="sky">
      <CardHead icon="drop" title="Hydratation" right={compact ? <a className="small" href="#/hydratation">Détails</a> : undefined} />
      <div className="row" style={{ gap: 16 }}>
        <Ring value={total} max={goal} color="var(--sky)">
          {formatQty(total, 'ml')}
          <span className="tiny muted">/ {formatQty(goal, 'ml')}</span>
        </Ring>
        <div className="col grow">
          <div className="grid3">
            {[150, 250, 500].map((ml) => (
              <Btn key={ml} small variant="secondary" onClick={() => addWater(ml)} aria-label={`Ajouter ${ml} ml`}>
                +{ml}
              </Btn>
            ))}
          </div>
          <div className="small muted">{reached ? 'Repère du jour atteint 💧' : 'Selon ta soif, l’activité et la météo.'}</div>
          {total > 0 && (
            <button className="btn ghost small" onClick={() => undoWater()}>
              Annuler le dernier ajout
            </button>
          )}
        </div>
      </div>
      {!compact && (
        <div className="row">
          <div className="grow">
            <NumberField label="Quantité personnalisée" value={custom} onChange={setCustom} suffix="ml" min={1} max={3000} />
          </div>
          <Btn
            style={{ alignSelf: 'flex-end' }}
            disabled={!custom}
            onClick={() => {
              if (custom) addWater(custom);
              setCustom(undefined);
            }}
          >
            Ajouter
          </Btn>
        </div>
      )}
    </Card>
  );
}
