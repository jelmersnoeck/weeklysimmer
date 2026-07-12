import "./VegCoverageStrip.css";

interface VegCoverageStripProps {
  vegBox: string[];
  unusedVeg: string[];
}

// Signature element: one chip per delivered vegetable. Used veg reads calm;
// unused veg flares in beet as a gentle "you still have this" warning.
export function VegCoverageStrip({ vegBox, unusedVeg }: VegCoverageStripProps) {
  const unused = new Set(unusedVeg.map((v) => v.toLowerCase()));
  const usedCount = vegBox.filter((v) => !unused.has(v.toLowerCase())).length;

  return (
    <section className="veg-strip" aria-label="Veg box coverage">
      <div className="veg-strip__head">
        <h2 className="veg-strip__title">This week's veg box</h2>
        <p className="veg-strip__count mono">
          {usedCount}/{vegBox.length} used
        </p>
      </div>
      <ul className="veg-strip__chips" role="list">
        {vegBox.map((veg) => {
          const isUnused = unused.has(veg.toLowerCase());
          return (
            <li
              key={veg}
              className={`veg-strip__chip${isUnused ? " is-unused" : ""}`}
              aria-label={isUnused ? `${veg}, not used yet` : veg}
            >
              <span className="veg-strip__chip-name">{veg}</span>
              {isUnused && (
                <span className="veg-strip__chip-flag">not used yet</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
