"""SQLite catalog for storing CompanyCam project and photo analysis data."""
import json
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path


class Catalog:
    """SQLite-backed catalog with FTS5 full-text search."""

    def __init__(self, db_path: Path | str = None):
        if db_path is None:
            db_path = Path(__file__).parent.parent / "catalog.db"
        self.db = sqlite3.connect(str(db_path))
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    def _create_tables(self):
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT DEFAULT '',
                lat REAL DEFAULT 0,
                lng REAL DEFAULT 0,
                created_at TEXT DEFAULT '',
                photo_count INTEGER DEFAULT 0,
                last_synced TEXT,
                last_analyzed TEXT,
                summary TEXT,
                notepad TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                uri TEXT NOT NULL,
                thumb_uri TEXT DEFAULT '',
                taken_at TEXT DEFAULT '',
                creator_name TEXT DEFAULT '',
                triage_status TEXT,
                scene TEXT,
                service_types TEXT,
                phase TEXT,
                entities TEXT,
                marketing_score INTEGER,
                marketing_notes TEXT,
                before_after_potential INTEGER DEFAULT 0,
                damage_details TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id);
            CREATE INDEX IF NOT EXISTS idx_photos_score ON photos(marketing_score);

            CREATE VIRTUAL TABLE IF NOT EXISTS photo_fts USING fts5(
                id UNINDEXED,
                scene,
                marketing_notes,
                entities,
                service_types,
                content='photos',
                content_rowid='rowid'
            );

            CREATE TRIGGER IF NOT EXISTS photos_ai AFTER INSERT ON photos
            WHEN NEW.scene IS NOT NULL
            BEGIN
                INSERT INTO photo_fts(rowid, id, scene, marketing_notes, entities, service_types)
                VALUES (NEW.rowid, NEW.id, NEW.scene, NEW.marketing_notes, NEW.entities, NEW.service_types);
            END;

            CREATE TRIGGER IF NOT EXISTS photos_au AFTER UPDATE ON photos
            WHEN NEW.scene IS NOT NULL AND OLD.scene IS NOT NULL
            BEGIN
                DELETE FROM photo_fts WHERE rowid = OLD.rowid;
                INSERT INTO photo_fts(rowid, id, scene, marketing_notes, entities, service_types)
                VALUES (NEW.rowid, NEW.id, NEW.scene, NEW.marketing_notes, NEW.entities, NEW.service_types);
            END;

            CREATE TRIGGER IF NOT EXISTS photos_au_first AFTER UPDATE ON photos
            WHEN NEW.scene IS NOT NULL AND OLD.scene IS NULL
            BEGIN
                INSERT INTO photo_fts(rowid, id, scene, marketing_notes, entities, service_types)
                VALUES (NEW.rowid, NEW.id, NEW.scene, NEW.marketing_notes, NEW.entities, NEW.service_types);
            END;

            CREATE TRIGGER IF NOT EXISTS photos_ad AFTER DELETE ON photos BEGIN
                DELETE FROM photo_fts WHERE rowid = OLD.rowid;
            END;
        """)
        # Migrations for existing databases
        try:
            self.db.execute("SELECT summary FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN summary TEXT")
        try:
            self.db.execute("SELECT damage_details FROM photos LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE photos ADD COLUMN damage_details TEXT")
        try:
            self.db.execute("SELECT notepad FROM projects LIMIT 0")
        except sqlite3.OperationalError:
            self.db.execute("ALTER TABLE projects ADD COLUMN notepad TEXT DEFAULT ''")

        # daily_reports table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS daily_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                report_date TEXT NOT NULL,
                report_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                UNIQUE(project_id, report_date)
            )
        """)

        # weekly_reports table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS weekly_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                week_start TEXT NOT NULL,
                report_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                UNIQUE(project_id, week_start)
            )
        """)

        # project_reports table — one row per generation, history preserved
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS project_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                report_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                model TEXT
            )
        """)
        self.db.execute(
            "CREATE INDEX IF NOT EXISTS idx_project_reports_project ON project_reports(project_id)"
        )

    def close(self):
        self.db.close()

    # --- Projects ---

    def upsert_project(self, project: dict):
        self.db.execute("""
            INSERT INTO projects (id, name, address, lat, lng, created_at, photo_count, notepad)
            VALUES (:id, :name, :address, :lat, :lng, :created_at, :photo_count, :notepad)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, address=excluded.address,
                lat=excluded.lat, lng=excluded.lng,
                photo_count=excluded.photo_count,
                notepad=excluded.notepad
        """, project)
        self.db.commit()

    def get_project(self, project_id: str) -> dict | None:
        row = self.db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        return dict(row) if row else None

    def list_projects(self, query: str = None, page: int = 1, per_page: int = 50) -> list[dict]:
        offset = (page - 1) * per_page
        if query:
            rows = self.db.execute(
                "SELECT * FROM projects WHERE name LIKE ? OR address LIKE ? ORDER BY last_synced DESC NULLS LAST, created_at DESC LIMIT ? OFFSET ?",
                (f"%{query}%", f"%{query}%", per_page, offset),
            ).fetchall()
        else:
            rows = self.db.execute(
                "SELECT * FROM projects ORDER BY last_synced DESC NULLS LAST, created_at DESC LIMIT ? OFFSET ?",
                (per_page, offset),
            ).fetchall()
        return [dict(r) for r in rows]

    def set_project_synced(self, project_id: str):
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute("UPDATE projects SET last_synced = ? WHERE id = ?", (now, project_id))
        self.db.commit()

    def set_project_analyzed(self, project_id: str):
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute("UPDATE projects SET last_analyzed = ? WHERE id = ?", (now, project_id))
        self.db.commit()

    def set_project_summary(self, project_id: str, summary: dict):
        self.db.execute("UPDATE projects SET summary = ? WHERE id = ?",
                        (json.dumps(summary), project_id))
        self.db.commit()

    def get_project_summary_data(self, project_id: str) -> dict | None:
        row = self.db.execute("SELECT summary FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row and row[0]:
            return json.loads(row[0])
        return None

    # --- Daily Reports ---

    def save_daily_report(self, project_id: str, report_date: str, report_data: dict):
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute("""
            INSERT INTO daily_reports (project_id, report_date, report_data, generated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id, report_date) DO UPDATE SET
                report_data=excluded.report_data, generated_at=excluded.generated_at
        """, (project_id, report_date, json.dumps(report_data), now))
        self.db.commit()

    def get_daily_reports(self, report_date: str) -> list[dict]:
        rows = self.db.execute("""
            SELECT dr.*, p.name as project_name, p.address as project_address
            FROM daily_reports dr
            JOIN projects p ON dr.project_id = p.id
            WHERE dr.report_date = ?
            ORDER BY p.name
        """, (report_date,)).fetchall()
        return [dict(r) for r in rows]

    def get_photos_for_date(self, project_id: str, ts_start: int, ts_end: int) -> list[dict]:
        """Get analyzed photos for a project within a Unix timestamp range."""
        rows = self.db.execute("""
            SELECT * FROM photos
            WHERE project_id = ? AND scene IS NOT NULL
              AND CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?
            ORDER BY marketing_score DESC, taken_at
        """, (project_id, ts_start, ts_end)).fetchall()
        return [dict(r) for r in rows]

    # --- Weekly Reports ---

    def save_weekly_report(self, project_id: str, week_start: str, report_data: dict):
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute("""
            INSERT INTO weekly_reports (project_id, week_start, report_data, generated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id, week_start) DO UPDATE SET
                report_data=excluded.report_data, generated_at=excluded.generated_at
        """, (project_id, week_start, json.dumps(report_data), now))
        self.db.commit()

    def get_weekly_reports(self, week_start: str) -> list[dict]:
        rows = self.db.execute("""
            SELECT wr.*, p.name as project_name, p.address as project_address
            FROM weekly_reports wr
            JOIN projects p ON wr.project_id = p.id
            WHERE wr.week_start = ?
            ORDER BY p.name
        """, (week_start,)).fetchall()
        return [dict(r) for r in rows]

    # --- Project Reports ---

    def save_project_report(self, project_id: str, report_data: dict, model: str = "") -> int:
        """Insert a new project report row. Returns the new row id."""
        now = datetime.now(timezone.utc).isoformat()
        cur = self.db.execute(
            """
            INSERT INTO project_reports (project_id, report_data, generated_at, model)
            VALUES (?, ?, ?, ?)
            """,
            (project_id, json.dumps(report_data), now, model),
        )
        self.db.commit()
        return cur.lastrowid

    def get_project_report(self, report_id: int) -> dict | None:
        row = self.db.execute(
            """
            SELECT pr.*, p.name AS project_name, p.address AS project_address
            FROM project_reports pr
            LEFT JOIN projects p ON pr.project_id = p.id
            WHERE pr.id = ?
            """,
            (report_id,),
        ).fetchone()
        return dict(row) if row else None

    def list_project_reports(self, project_id: str | None = None) -> list[dict]:
        """If project_id given: all reports for that project, newest first.
        Otherwise: latest report per project across all projects."""
        if project_id:
            rows = self.db.execute(
                """
                SELECT pr.*, p.name AS project_name, p.address AS project_address
                FROM project_reports pr
                LEFT JOIN projects p ON pr.project_id = p.id
                WHERE pr.project_id = ?
                ORDER BY pr.id DESC
                """,
                (project_id,),
            ).fetchall()
        else:
            rows = self.db.execute(
                """
                SELECT pr.*, p.name AS project_name, p.address AS project_address
                FROM project_reports pr
                LEFT JOIN projects p ON pr.project_id = p.id
                WHERE pr.id IN (
                    SELECT MAX(id) FROM project_reports GROUP BY project_id
                )
                ORDER BY pr.generated_at DESC
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def get_eligible_weekly_projects(self, ts_start: int, ts_end: int, min_days: int = 3) -> list[dict]:
        """Find projects with min_days+ distinct photo days in the given timestamp range."""
        rows = self.db.execute("""
            SELECT p.project_id, pr.name, pr.address,
                   COUNT(DISTINCT date(CAST(p.taken_at AS INTEGER), 'unixepoch')) as photo_days,
                   COUNT(*) as photo_count
            FROM photos p
            JOIN projects pr ON p.project_id = pr.id
            WHERE p.scene IS NOT NULL
              AND CAST(p.taken_at AS INTEGER) >= ?
              AND CAST(p.taken_at AS INTEGER) < ?
            GROUP BY p.project_id
            HAVING photo_days >= ?
            ORDER BY photo_days DESC, photo_count DESC
        """, (ts_start, ts_end, min_days)).fetchall()
        return [dict(r) for r in rows]

    def get_photos_for_week(self, project_id: str, ts_start: int, ts_end: int) -> list[dict]:
        """Get all analyzed photos for a project in a week range, ordered by date then score."""
        rows = self.db.execute("""
            SELECT * FROM photos
            WHERE project_id = ? AND scene IS NOT NULL
              AND CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?
            ORDER BY CAST(taken_at AS INTEGER), marketing_score DESC
        """, (project_id, ts_start, ts_end)).fetchall()
        return [dict(r) for r in rows]

    # --- Photos ---

    def upsert_photo(self, photo: dict):
        self.db.execute("""
            INSERT INTO photos (id, project_id, uri, thumb_uri, taken_at, creator_name)
            VALUES (:id, :project_id, :uri, :thumb_uri, :taken_at, :creator_name)
            ON CONFLICT(id) DO UPDATE SET
                uri=excluded.uri, thumb_uri=excluded.thumb_uri,
                taken_at=excluded.taken_at, creator_name=excluded.creator_name
        """, photo)
        self.db.commit()

    def get_photo(self, photo_id: str) -> dict | None:
        row = self.db.execute("SELECT * FROM photos WHERE id = ?", (photo_id,)).fetchone()
        return dict(row) if row else None

    def update_photo_analysis(self, photo_id: str, analysis: dict):
        damage = analysis.get("damage_details")
        self.db.execute("""
            UPDATE photos SET
                triage_status = :triage_status,
                scene = :scene,
                service_types = :service_types,
                phase = :phase,
                entities = :entities,
                marketing_score = :marketing_score,
                marketing_notes = :marketing_notes,
                before_after_potential = :before_after_potential,
                damage_details = :damage_details
            WHERE id = :id
        """, {
            "id": photo_id,
            "triage_status": analysis.get("triage_status"),
            "scene": analysis.get("scene"),
            "service_types": json.dumps(analysis.get("service_types", [])),
            "phase": analysis.get("phase"),
            "entities": json.dumps(analysis.get("entities", [])),
            "marketing_score": analysis.get("marketing_score"),
            "marketing_notes": analysis.get("marketing_notes", ""),
            "before_after_potential": 1 if analysis.get("before_after_potential") else 0,
            "damage_details": json.dumps(damage) if damage else None,
        })
        self.db.commit()

    def get_unanalyzed_photos(self, project_id: str) -> list[dict]:
        rows = self.db.execute(
            "SELECT * FROM photos WHERE project_id = ? AND scene IS NULL ORDER BY taken_at",
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_project_photos(self, project_id: str, page: int = 1, per_page: int = 50) -> list[dict]:
        offset = (page - 1) * per_page
        rows = self.db.execute(
            "SELECT * FROM photos WHERE project_id = ? ORDER BY taken_at DESC LIMIT ? OFFSET ?",
            (project_id, per_page, offset),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_project_summary(self, project_id: str) -> dict | None:
        """Get analysis summary stats for a single project."""
        row = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE project_id = ?", (project_id,)
        ).fetchone()
        total_synced = row[0] if row else 0
        if total_synced == 0:
            return None

        analyzed = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE project_id = ? AND scene IS NOT NULL", (project_id,)
        ).fetchone()[0]
        picks = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE project_id = ? AND marketing_score >= 4", (project_id,)
        ).fetchone()[0]
        ba = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE project_id = ? AND before_after_potential = 1", (project_id,)
        ).fetchone()[0]

        # Service types
        rows = self.db.execute(
            "SELECT service_types FROM photos WHERE project_id = ? AND service_types IS NOT NULL AND scene IS NOT NULL",
            (project_id,),
        ).fetchall()
        services = set()
        for r in rows:
            for svc in json.loads(r[0]):
                services.add(svc)

        # Phase counts
        phase_rows = self.db.execute(
            "SELECT phase, COUNT(*) FROM photos WHERE project_id = ? AND phase IS NOT NULL GROUP BY phase",
            (project_id,),
        ).fetchall()
        phases = {r[0]: r[1] for r in phase_rows}

        # Average score
        avg_row = self.db.execute(
            "SELECT AVG(marketing_score) FROM photos WHERE project_id = ? AND marketing_score IS NOT NULL",
            (project_id,),
        ).fetchone()
        avg_score = round(avg_row[0], 1) if avg_row[0] else 0

        return {
            "photos_synced": total_synced,
            "photos_analyzed": analyzed,
            "marketing_picks": picks,
            "before_after_count": ba,
            "services": sorted(services),
            "phases": phases,
            "avg_score": avg_score,
        }

    def get_project_summaries(self, project_ids: list[str]) -> dict[str, dict]:
        """Get analysis summaries for multiple projects at once."""
        return {pid: self.get_project_summary(pid) for pid in project_ids if self.get_project_summary(pid)}

    # --- Search ---

    def search_photos(self, q: str = None, service: str = None, phase: str = None,
                      min_score: int = 0, project_id: str = None,
                      before_after_only: bool = False,
                      date_from: str = None, date_to: str = None,
                      page: int = 1, per_page: int = 50) -> list[dict]:
        conditions = ["p.scene IS NOT NULL"]
        params: list = []

        if q:
            conditions.append("p.id IN (SELECT id FROM photo_fts WHERE photo_fts MATCH ?)")
            params.append(q)
        if service:
            conditions.append("p.service_types LIKE ?")
            params.append(f'%"{service}"%')
        if phase:
            conditions.append("p.phase = ?")
            params.append(phase)
        if min_score > 0:
            conditions.append("p.marketing_score >= ?")
            params.append(min_score)
        if project_id:
            conditions.append("p.project_id = ?")
            params.append(project_id)
        if before_after_only:
            conditions.append("p.before_after_potential = 1")
        if date_from:
            conditions.append("CAST(p.taken_at AS INTEGER) >= ?")
            params.append(int(datetime.fromisoformat(date_from).timestamp()) if not date_from.isdigit() else int(date_from))
        if date_to:
            conditions.append("CAST(p.taken_at AS INTEGER) <= ?")
            params.append(int(datetime.fromisoformat(date_to).timestamp()) if not date_to.isdigit() else int(date_to))

        where = " AND ".join(conditions)
        offset = (page - 1) * per_page
        rows = self.db.execute(
            f"SELECT p.*, pr.name as project_name FROM photos p JOIN projects pr ON p.project_id = pr.id WHERE {where} ORDER BY p.marketing_score DESC, p.taken_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Stats ---

    def get_stats(self) -> dict:
        projects_analyzed = self.db.execute(
            "SELECT COUNT(DISTINCT project_id) FROM photos WHERE scene IS NOT NULL"
        ).fetchone()[0]
        photos_analyzed = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE scene IS NOT NULL"
        ).fetchone()[0]
        marketing_picks = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE marketing_score >= 4"
        ).fetchone()[0]
        before_after_count = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE before_after_potential = 1"
        ).fetchone()[0]

        rows = self.db.execute(
            "SELECT service_types FROM photos WHERE scene IS NOT NULL AND service_types IS NOT NULL"
        ).fetchall()
        service_counts: dict[str, int] = {}
        for row in rows:
            for svc in json.loads(row[0]):
                service_counts[svc] = service_counts.get(svc, 0) + 1

        score_dist = {}
        for row in self.db.execute(
            "SELECT marketing_score, COUNT(*) FROM photos WHERE marketing_score IS NOT NULL GROUP BY marketing_score"
        ).fetchall():
            score_dist[row[0]] = row[1]

        phase_counts = {}
        for row in self.db.execute(
            "SELECT phase, COUNT(*) FROM photos WHERE phase IS NOT NULL GROUP BY phase"
        ).fetchall():
            phase_counts[row[0]] = row[1]

        return {
            "projects_analyzed": projects_analyzed,
            "photos_analyzed": photos_analyzed,
            "marketing_picks": marketing_picks,
            "before_after_count": before_after_count,
            "service_counts": dict(sorted(service_counts.items(), key=lambda x: -x[1])),
            "score_distribution": score_dist,
            "phase_counts": phase_counts,
        }

    def get_weekly_activity(self) -> dict:
        """Photo counts by week. taken_at is stored as Unix timestamps (strings)."""
        import time
        now = time.time()
        # Monday 00:00 UTC of this week
        dt_now = datetime.now(timezone.utc)
        monday = dt_now - timedelta(days=dt_now.weekday())
        this_week_ts = int(monday.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
        last_week_ts = this_week_ts - 7 * 86400

        # CAST taken_at to integer for numeric comparison (stored as Unix timestamp strings)
        this_week = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE CAST(taken_at AS INTEGER) >= ?", (this_week_ts,)
        ).fetchone()[0]
        last_week = self.db.execute(
            "SELECT COUNT(*) FROM photos WHERE CAST(taken_at AS INTEGER) >= ? AND CAST(taken_at AS INTEGER) < ?",
            (last_week_ts, this_week_ts),
        ).fetchone()[0]
        projects_this_week = self.db.execute(
            "SELECT COUNT(DISTINCT project_id) FROM photos WHERE CAST(taken_at AS INTEGER) >= ?", (this_week_ts,)
        ).fetchone()[0]

        return {
            "photos_this_week": this_week,
            "photos_last_week": last_week,
            "projects_with_new_photos": projects_this_week,
        }
