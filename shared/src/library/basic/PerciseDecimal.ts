/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export class PreciseDecimal 
{
    private _value:string;

    constructor(value:number | string) 
    {
        this._value = String(value);

        if (this._value.includes('.')) 
        {
            const decimalPlaces = this._value.split('.')[1].length;
            if (decimalPlaces > 8) throw new Error('Cannot have more than 8 decimal places');
        }

        if (!/^-?[0-9]+(\.[0-9]+)?$/.test(this._value)) throw new Error('Invalid value');
        
        this._value = this.#removeLeadingZeroes(this._value);
    }

    #removeLeadingZeroes(value:string):string 
    {
        const [integerPart, decimalPart] = value.split('.');
        return `${integerPart.replace(/^0+/, '') || '0'}.${decimalPart || '0'}`;
    }

    static #alignDecimals(a:string, b:string):[string, string] 
    {
        const aDecimals = (a.split('.')[1] || '').length;
        const bDecimals = (b.split('.')[1] || '').length;
        const maxDecimals = Math.max(aDecimals, bDecimals);

        return [a + '0'.repeat(maxDecimals - aDecimals), b + '0'.repeat(maxDecimals - bDecimals)];
    }

    public add(other:PreciseDecimal):PreciseDecimal 
    {
        if (this._value.startsWith('-')) 
        {
            if (other._value.startsWith('-')) return new PreciseDecimal('-' + new PreciseDecimal(this._value.slice(1)).add(new PreciseDecimal(other._value.slice(1)))._value);
            else return new PreciseDecimal(other._value).subtract(new PreciseDecimal(this._value.slice(1)));
        } 
        else if (other._value.startsWith('-')) return this.subtract(new PreciseDecimal(other._value.slice(1)));
        
        let [a, b] = PreciseDecimal.#alignDecimals(this._value, other._value);
        a = a.replace('.', '');
        b = b.replace('.', '');

        let carry = 0;
        let result = '';

        for (let i = a.length - 1; i >= 0; i--) 
        {
            const sum = Number(a[i]) + Number(b[i]) + carry;
            carry = Math.floor(sum / 10);
            result = (sum % 10) + result;
        }

        if (carry > 0) result = carry + result;
        
        return new PreciseDecimal(result.slice(0, -8) + '.' + result.slice(-8));
    }

    public subtract(other:PreciseDecimal):PreciseDecimal 
    {
        if (other._value.startsWith('-')) return this.add(new PreciseDecimal(other._value.slice(1)));
        else if (this._value.startsWith('-')) return new PreciseDecimal('-' + new PreciseDecimal(this._value.slice(1)).add(other));
        else if (this.lessThan(other)) return new PreciseDecimal('-' + other.subtract(this)._value);
        
        let [a, b] = PreciseDecimal.#alignDecimals(this._value, other._value);
        a = a.replace('.', '');
        b = b.replace('.', '');

        let borrow = 0;
        let result = '';

        for (let i = a.length - 1; i >= 0; i--) 
        {
            let diff = Number(a[i]) - Number(b[i]) - borrow;
            if (diff < 0) 
            {
                diff += 10;
                borrow = 1;
            } 
            else borrow = 0;
            
            result = diff + result;
        }

        return new PreciseDecimal(this.#removeLeadingZeroes(result.slice(0, -8) + '.' + result.slice(-8)));
    }

    public lessThan(other:PreciseDecimal):boolean 
    {
        if (this._value.startsWith('-')) 
        {
            if (other._value.startsWith('-')) return new PreciseDecimal(this._value.slice(1)).greaterThan(new PreciseDecimal(other._value.slice(1)));
            else return true;
        } else if (other._value.startsWith('-')) return false;

        let [a, b] = PreciseDecimal.#alignDecimals(this._value, other._value);
        a = a.replace('.', '');
        b = b.replace('.', '');

        return a < b;
    }

    public greaterThan(other:PreciseDecimal):boolean 
    {
        return other.lessThan(this);
    }

    public equalTo(other: PreciseDecimal):boolean 
    {
        return this._value === other._value;
    }

    public toFixed(decimalPlaces:number):string 
    {
        const result = this._value.slice(0, this._value.indexOf('.') + decimalPlaces + 1);
        return result + '0'.repeat(decimalPlaces - (result.length - result.indexOf('.') - 1));
    }

    public toInteger(): string 
    {
        return this._value.replace('.', '');
    }

    public toTuple():[Number, Number]
    {
        const parts = this._value.split('.');

        return [parseInt(parts[0]), parseInt(parts[1])];
    }

    public static fromInteger(integer: string): PreciseDecimal 
    {
        return new PreciseDecimal(integer.slice(0, -8) + '.' + integer.slice(-8));
    }
}
