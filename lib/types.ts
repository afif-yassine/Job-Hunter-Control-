export type Job={id:string;company:string;title:string;contract_type:string|null;location:string|null;source_url:string|null;match_score:number|null;status:string;publication_date:string|null};
export type Application={id:string;status:string;platform:string|null;created_at:string;jobs?:{company:string;title:string}|null};
export type Question={id:string;question:string;category:string;answer:string|null;blocking:boolean;approved:boolean};
