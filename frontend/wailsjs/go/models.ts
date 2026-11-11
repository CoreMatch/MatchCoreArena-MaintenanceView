export namespace models {
	
	export class RedisConfig {
	    addr: string;
	    password: string;
	    db: number;
	
	    static createFrom(source: any = {}) {
	        return new RedisConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.addr = source["addr"];
	        this.password = source["password"];
	        this.db = source["db"];
	    }
	}
	export class DatabaseConfig {
	    dsn: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dsn = source["dsn"];
	    }
	}
	export class MCAConfig {
	    reporter_token: string;
	
	    static createFrom(source: any = {}) {
	        return new MCAConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.reporter_token = source["reporter_token"];
	    }
	}
	export class Config {
	    upstream_url: string;
	    management_token: string;
	    mca: MCAConfig;
	    database: DatabaseConfig;
	    redis: RedisConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.upstream_url = source["upstream_url"];
	        this.management_token = source["management_token"];
	        this.mca = this.convertValues(source["mca"], MCAConfig);
	        this.database = this.convertValues(source["database"], DatabaseConfig);
	        this.redis = this.convertValues(source["redis"], RedisConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ConfigHistoryItem {
	    version: string;
	    // Go type: time
	    timestamp: any;
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new ConfigHistoryItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.filename = source["filename"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class JoinTarget {
	    host: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new JoinTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	    }
	}
	export class GroupMember {
	    uid: number;
	    team_id: string;
	    rank_score: number;
	
	    static createFrom(source: any = {}) {
	        return new GroupMember(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.team_id = source["team_id"];
	        this.rank_score = source["rank_score"];
	    }
	}
	export class FormedGroup {
	    group_id: number;
	    match_type: string;
	    formed_at: string;
	    members: GroupMember[];
	    join_target?: JoinTarget;
	    room?: string;
	
	    static createFrom(source: any = {}) {
	        return new FormedGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group_id = source["group_id"];
	        this.match_type = source["match_type"];
	        this.formed_at = source["formed_at"];
	        this.members = this.convertValues(source["members"], GroupMember);
	        this.join_target = this.convertValues(source["join_target"], JoinTarget);
	        this.room = source["room"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class ParticipantDetail {
	    uid: number;
	    team_id: string;
	    is_winner: boolean;
	    is_draw: boolean;
	    rank_score_before: number;
	    rank_score_delta: number;
	    rank_score_after: number;
	    survival_time: number;
	    kills: number;
	    deaths: number;
	
	    static createFrom(source: any = {}) {
	        return new ParticipantDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.team_id = source["team_id"];
	        this.is_winner = source["is_winner"];
	        this.is_draw = source["is_draw"];
	        this.rank_score_before = source["rank_score_before"];
	        this.rank_score_delta = source["rank_score_delta"];
	        this.rank_score_after = source["rank_score_after"];
	        this.survival_time = source["survival_time"];
	        this.kills = source["kills"];
	        this.deaths = source["deaths"];
	    }
	}
	export class Match {
	    id: number;
	    match_type: string;
	    source: string;
	    map_name: string;
	    server_id: string;
	    game_id: string;
	    winner_team_id: string;
	    survival_rate: number;
	    duration_seconds: number;
	    started_at: string;
	    finished_at: string;
	    created_at: string;
	    participants?: ParticipantDetail[];
	
	    static createFrom(source: any = {}) {
	        return new Match(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.match_type = source["match_type"];
	        this.source = source["source"];
	        this.map_name = source["map_name"];
	        this.server_id = source["server_id"];
	        this.game_id = source["game_id"];
	        this.winner_team_id = source["winner_team_id"];
	        this.survival_rate = source["survival_rate"];
	        this.duration_seconds = source["duration_seconds"];
	        this.started_at = source["started_at"];
	        this.finished_at = source["finished_at"];
	        this.created_at = source["created_at"];
	        this.participants = this.convertValues(source["participants"], ParticipantDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MatchListQuery {
	    source: string;
	    map_name: string;
	    game_id: string;
	    uid: number;
	    finished_from: string;
	    finished_to: string;
	    page_num: number;
	    page_size: number;
	
	    static createFrom(source: any = {}) {
	        return new MatchListQuery(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.map_name = source["map_name"];
	        this.game_id = source["game_id"];
	        this.uid = source["uid"];
	        this.finished_from = source["finished_from"];
	        this.finished_to = source["finished_to"];
	        this.page_num = source["page_num"];
	        this.page_size = source["page_size"];
	    }
	}
	export class MatchResult {
	    match_id: string;
	    uid: number;
	    rank: number;
	    score_delta: number;
	    is_winner: boolean;
	    // Go type: time
	    match_time: any;
	    survivor_count: number;
	
	    static createFrom(source: any = {}) {
	        return new MatchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.match_id = source["match_id"];
	        this.uid = source["uid"];
	        this.rank = source["rank"];
	        this.score_delta = source["score_delta"];
	        this.is_winner = source["is_winner"];
	        this.match_time = this.convertValues(source["match_time"], null);
	        this.survivor_count = source["survivor_count"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class QueueStats {
	    players: number;
	    parties: number;
	    average_wait_seconds: number;
	
	    static createFrom(source: any = {}) {
	        return new QueueStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.players = source["players"];
	        this.parties = source["parties"];
	        this.average_wait_seconds = source["average_wait_seconds"];
	    }
	}
	export class QueueEntry {
	    uid: number;
	    match_type: string;
	    rank_score: number;
	    enqueued_at: string;
	
	    static createFrom(source: any = {}) {
	        return new QueueEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.match_type = source["match_type"];
	        this.rank_score = source["rank_score"];
	        this.enqueued_at = source["enqueued_at"];
	    }
	}
	export class MatchmakingStatus {
	    in_queue: boolean;
	    queue_entry?: QueueEntry;
	    recent_groups: FormedGroup[];
	    queue_stats?: QueueStats;
	
	    static createFrom(source: any = {}) {
	        return new MatchmakingStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.in_queue = source["in_queue"];
	        this.queue_entry = this.convertValues(source["queue_entry"], QueueEntry);
	        this.recent_groups = this.convertValues(source["recent_groups"], FormedGroup);
	        this.queue_stats = this.convertValues(source["queue_stats"], QueueStats);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MetricsSnapshot {
	    counters: Record<string, number>;
	    queue_depth: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new MetricsSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.counters = source["counters"];
	        this.queue_depth = source["queue_depth"];
	    }
	}
	export class OpsIdentity {
	    reporter_configured: boolean;
	    using_fallback: boolean;
	    upstream_url: string;
	
	    static createFrom(source: any = {}) {
	        return new OpsIdentity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.reporter_configured = source["reporter_configured"];
	        this.using_fallback = source["using_fallback"];
	        this.upstream_url = source["upstream_url"];
	    }
	}
	
	export class ParticipantReport {
	    uuid: string;
	    survival_time?: number;
	    kills?: number;
	    deaths?: number;
	    perf_tweak?: number;
	
	    static createFrom(source: any = {}) {
	        return new ParticipantReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.survival_time = source["survival_time"];
	        this.kills = source["kills"];
	        this.deaths = source["deaths"];
	        this.perf_tweak = source["perf_tweak"];
	    }
	}
	export class PlayerMatchRow {
	    match_id: number;
	    match_type: string;
	    source: string;
	    map_name: string;
	    winner_team_id: string;
	    duration_seconds: number;
	    started_at: string;
	    finished_at: string;
	    team_id: string;
	    is_winner: number;
	    is_draw: number;
	    rank_score_before: number;
	    rank_score_delta: number;
	
	    static createFrom(source: any = {}) {
	        return new PlayerMatchRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.match_id = source["match_id"];
	        this.match_type = source["match_type"];
	        this.source = source["source"];
	        this.map_name = source["map_name"];
	        this.winner_team_id = source["winner_team_id"];
	        this.duration_seconds = source["duration_seconds"];
	        this.started_at = source["started_at"];
	        this.finished_at = source["finished_at"];
	        this.team_id = source["team_id"];
	        this.is_winner = source["is_winner"];
	        this.is_draw = source["is_draw"];
	        this.rank_score_before = source["rank_score_before"];
	        this.rank_score_delta = source["rank_score_delta"];
	    }
	}
	
	
	export class Ranking {
	    id: number;
	    user_uid: number;
	    user_uuid: string;
	    rank_type: string;
	    score: number;
	    rank_position: number;
	    season: number;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Ranking(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_uid = source["user_uid"];
	        this.user_uuid = source["user_uuid"];
	        this.rank_type = source["rank_type"];
	        this.score = source["score"];
	        this.rank_position = source["rank_position"];
	        this.season = source["season"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class RatingSimInput {
	    player_rating: number;
	    opponent_rating: number;
	    wins_count: number;
	    survivor_count: number;
	    initial_count: number;
	    streak: number;
	    performance: number;
	    is_winner: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RatingSimInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.player_rating = source["player_rating"];
	        this.opponent_rating = source["opponent_rating"];
	        this.wins_count = source["wins_count"];
	        this.survivor_count = source["survivor_count"];
	        this.initial_count = source["initial_count"];
	        this.streak = source["streak"];
	        this.performance = source["performance"];
	        this.is_winner = source["is_winner"];
	    }
	}
	export class RatingSimResult {
	    delta: number;
	    expected_win_rate: number;
	    k_factor: number;
	    survival_weight: number;
	    streak_weight: number;
	    perf_weight: number;
	
	    static createFrom(source: any = {}) {
	        return new RatingSimResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.delta = source["delta"];
	        this.expected_win_rate = source["expected_win_rate"];
	        this.k_factor = source["k_factor"];
	        this.survival_weight = source["survival_weight"];
	        this.streak_weight = source["streak_weight"];
	        this.perf_weight = source["perf_weight"];
	    }
	}
	
	export class RejectionRecord {
	    time: string;
	    code: string;
	    game_id: string;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new RejectionRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.time = source["time"];
	        this.code = source["code"];
	        this.game_id = source["game_id"];
	        this.reason = source["reason"];
	    }
	}
	export class RequestLogEntry {
	    time: string;
	    method: string;
	    path: string;
	    status: number;
	    code?: string;
	    ok: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RequestLogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.time = source["time"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.status = source["status"];
	        this.code = source["code"];
	        this.ok = source["ok"];
	    }
	}
	export class SystemStats {
	    total_users: number;
	
	    static createFrom(source: any = {}) {
	        return new SystemStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_users = source["total_users"];
	    }
	}
	export class TeamReportInfo {
	    team_id: string;
	    initial_count?: number;
	    alive_count?: number;
	    members: ParticipantReport[];
	
	    static createFrom(source: any = {}) {
	        return new TeamReportInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.team_id = source["team_id"];
	        this.initial_count = source["initial_count"];
	        this.alive_count = source["alive_count"];
	        this.members = this.convertValues(source["members"], ParticipantReport);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TeamReportInput {
	    match_type: string;
	    winner_team: TeamReportInfo;
	    loser_teams: TeamReportInfo[];
	    duration_seconds?: number;
	    source?: string;
	    matchmaking_group_id?: number;
	    started_at?: string;
	    finished_at?: string;
	
	    static createFrom(source: any = {}) {
	        return new TeamReportInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.match_type = source["match_type"];
	        this.winner_team = this.convertValues(source["winner_team"], TeamReportInfo);
	        this.loser_teams = this.convertValues(source["loser_teams"], TeamReportInfo);
	        this.duration_seconds = source["duration_seconds"];
	        this.source = source["source"];
	        this.matchmaking_group_id = source["matchmaking_group_id"];
	        this.started_at = source["started_at"];
	        this.finished_at = source["finished_at"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpstreamStatus {
	    reachable: boolean;
	    version: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new UpstreamStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.reachable = source["reachable"];
	        this.version = source["version"];
	        this.message = source["message"];
	    }
	}
	export class User {
	    uid: number;
	    level: number;
	    experience: number;
	    rank_score: number;
	    wins_count: number;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.level = source["level"];
	        this.experience = source["experience"];
	        this.rank_score = source["rank_score"];
	        this.wins_count = source["wins_count"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

