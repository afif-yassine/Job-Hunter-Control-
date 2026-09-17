export type Job={id:string;company:string;title:string;contract_type:string|null;location:string|null;source_url:string|null;official_url?:string|null;description?:string|null;match_score:number|null;score_breakdown?:Record<string,unknown>;status:string;publication_date:string|null};
export type Application={id:string;status:string;platform:string|null;created_at:string;jobs?:{company:string;title:string}|null};
export type Question={id:string;question:string;category:string;answer:string|null;blocking:boolean;approved:boolean};
export type DocumentRecord={id:string;job_id:string|null;kind:string;filename:string;version:number;approved:boolean;storage_path:string|null;created_at:string;jobs?:{company:string;title:string}|null};
export type AgentRun={id:string;run_type:string;status:string;created_at:string;error_message:string|null;counters:Record<string,unknown>};
