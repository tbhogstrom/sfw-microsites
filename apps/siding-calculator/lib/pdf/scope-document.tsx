import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Polygon,
  pdf,
} from '@react-pdf/renderer';
import type { Project, Elevation } from '../types';
import type { MaterialsLine } from '../materials';
import { renderScopeBullets } from './scope-templates';
import { wallSqFt, netSidingSqFt, trimLinFt } from '../geometry';
import { totalSidingSqFt, totalTrimLinFt } from '../materials';
import { PRESET_LABELS } from '../presets';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1c2230' },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: '#666', marginBottom: 16 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 10, fontWeight: 700, marginTop: 6, marginBottom: 4 },
  diagram: { height: 110, border: '1pt solid #ccc', marginBottom: 6 },
  table: { display: 'flex', flexDirection: 'column', borderTop: '0.5pt solid #ccc' },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #ccc', paddingVertical: 3 },
  th: { fontWeight: 700, fontSize: 9 },
  bullet: { marginBottom: 3, paddingLeft: 8 },
  footer: { marginTop: 16, fontSize: 8, color: '#888' },
});

const COL = [
  { key: 'phase', width: '15%' },
  { key: 'material', width: '40%' },
  { key: 'qty', width: '10%' },
  { key: 'unit', width: '10%' },
  { key: 'notes', width: '25%' },
];

function ElevationDiagram({ elevation }: { elevation: Elevation }) {
  const totalW = elevation.wall.rect.widthFt;
  const totalH = elevation.wall.rect.heightFt + (elevation.wall.gable?.peakHeightFt ?? 0);
  const scale = Math.min(500 / totalW, 100 / totalH);
  const w = totalW * scale;
  const h = totalH * scale;
  const wallH = elevation.wall.rect.heightFt * scale;
  const wallTopY = h - wallH;

  return (
    <Svg style={styles.diagram} viewBox={`0 0 ${w} ${h}`}>
      <Rect
        x={0}
        y={wallTopY}
        width={w}
        height={wallH}
        stroke="#2a4d8f"
        strokeWidth={1.5}
        fill="rgba(42,77,143,0.05)"
      />
      {elevation.wall.gable &&
        (() => {
          const peakX = w / 2 + elevation.wall.gable.peakOffsetFt * scale;
          const points = `0,${wallTopY} ${w},${wallTopY} ${peakX},0`;
          return (
            <Polygon
              points={points}
              stroke="#2a4d8f"
              strokeWidth={1.5}
              fill="rgba(42,77,143,0.05)"
            />
          );
        })()}
      {elevation.openings.map((o) => {
        const ox = o.x * scale;
        const oy = h - wallH + (elevation.wall.rect.heightFt - o.y - o.heightFt) * scale;
        const ow = o.widthFt * scale;
        const oh = o.heightFt * scale;
        return (
          <Rect
            key={o.id}
            x={ox}
            y={oy}
            width={ow}
            height={oh}
            stroke="#2a4d8f"
            strokeWidth={1}
            fill="white"
          />
        );
      })}
    </Svg>
  );
}

export function ScopeDocument({
  project,
  lines,
  shareUrl,
}: {
  project: Project;
  lines: MaterialsLine[];
  shareUrl: string;
}) {
  const bullets = renderScopeBullets(project);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>Siding Project Scope</Text>
        <Text style={styles.meta}>
          Project {project.id} · Generated {new Date().toLocaleDateString()} ·{' '}
          {PRESET_LABELS[project.scope.presetId]} · {project.elevations.length} elevation
          {project.elevations.length === 1 ? '' : 's'}
        </Text>

        <Text style={styles.h2}>Elevations</Text>
        {project.elevations.map((e) => (
          <View key={e.id} wrap={false}>
            <Text style={styles.h3}>
              {e.name} — {e.wall.rect.widthFt}' × {e.wall.rect.heightFt}'
              {e.wall.gable ? ` + gable peak ${e.wall.gable.peakHeightFt}'` : ''}
            </Text>
            <ElevationDiagram elevation={e} />
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>
              Wall {wallSqFt(e.wall).toFixed(0)} sq ft · Net siding{' '}
              {netSidingSqFt(e.wall, e.openings).toFixed(0)} sq ft · Trim{' '}
              {trimLinFt(e.wall, e.openings).toFixed(0)} lin ft
            </Text>
          </View>
        ))}

        <Text style={styles.h2}>Project totals</Text>
        <Text>
          Net siding (all elevations): {totalSidingSqFt(project).toFixed(0)} sq ft · Trim:{' '}
          {totalTrimLinFt(project).toFixed(0)} lin ft
        </Text>

        <Text style={styles.h2}>Materials</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            {COL.map((c) => (
              <Text key={c.key} style={[styles.th, { width: c.width }]}>
                {c.key}
              </Text>
            ))}
          </View>
          {lines.map((l) => (
            <View key={l.material.id + l.phase} style={styles.row}>
              <Text style={{ width: COL[0].width }}>{l.phase}</Text>
              <Text style={{ width: COL[1].width }}>{l.material.name}</Text>
              <Text style={{ width: COL[2].width }}>{l.qty}</Text>
              <Text style={{ width: COL[3].width }}>{l.unit}</Text>
              <Text style={{ width: COL[4].width }}>{l.coverageNote}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Scope of work</Text>
        {bullets.map((b, i) => (
          <Text key={i} style={styles.bullet}>
            • {b}
          </Text>
        ))}

        <Text style={styles.footer}>
          This scope is generated from your inputs in the SFW Siding Calculator. Shareable copy:{' '}
          {shareUrl}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderScopePdf(
  project: Project,
  lines: MaterialsLine[],
  shareUrl: string,
): Promise<Buffer> {
  const stream = await pdf(
    <ScopeDocument project={project} lines={lines} shareUrl={shareUrl} />,
  ).toBuffer();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
