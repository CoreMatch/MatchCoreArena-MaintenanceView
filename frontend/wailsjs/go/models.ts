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
	export class Config {
	    upstream_url: string;
	    management_token: string;
	    database: DatabaseConfig;
	    redis: RedisConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.upstream_url = source["upstream_url"];
	        this.management_token = source["management_token"];
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
	
	export class RedisKey {
	    key: string;
	    type: string;
	    ttl: number;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new RedisKey(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttl = source["ttl"];
	        this.value = source["value"];
	    }
	}
	export class SystemStats {
	    total_users: number;
	    active_matches: number;
	    redis_keys: number;
	
	    static createFrom(source: any = {}) {
	        return new SystemStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_users = source["total_users"];
	        this.active_matches = source["active_matches"];
	        this.redis_keys = source["redis_keys"];
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

