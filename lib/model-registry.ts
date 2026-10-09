export type LicensedModel={url:string;vehicleModel:string;license:string;provenance:string;maxTriangles:number};
// Only models with verified provenance and a matching vehicle enter this registry.
export const models:LicensedModel[]=[];
