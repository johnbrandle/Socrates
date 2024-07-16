/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export class CookieUtil
{
    public static parseCookies(cookieString:string | null): Record<string, string> 
    {
        const cookies: Record<string, string> = {};
        if (!cookieString) return cookies;
    
        cookieString.split(';').forEach(pair => 
        {
            const [key, value] = pair.trim().split('=');
          
            if (key && value) cookies[key] = decodeURIComponent(value);
        });
    
        return cookies;
    }
    
    public static setCookie(res:Request, key:string, value:string) 
    {
        const cookie = `${key}=${encodeURIComponent(value)}; Path=/; HttpOnly`;
        const currentCookies = res.headers.get('set-cookie');
      
        if (currentCookies) 
        {
            if (Array.isArray(currentCookies)) res.headers.set('set-cookie', [...currentCookies, cookie].join('; '));
            else res.headers.set('set-cookie', [currentCookies, cookie].join('; '));
        }
        else res.headers.set('set-cookie', cookie);
    }
}
