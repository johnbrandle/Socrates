export type SpaceOptions =
{
    isMobile:boolean;
    motionBlur:number; //Value between 0 (no motion blur) and 1 (full motion blur)
}

export type IFieldOptions =
{
    type:string;

    density:number;
    proximity:number;
    parallax:number;
    
    color:string;
    opacity:number;
    radius:{min:number, max:number}

    speed:{min:number, max:number};
}

export interface IRandomFieldOptions extends IFieldOptions
{
    type:"random";
}

export interface IConstellationFieldOptions extends IFieldOptions
{
    type:"constellation";

    lineOpacity:number;
    lineColor:string;
    lineWidth:number;
}