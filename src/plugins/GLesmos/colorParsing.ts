// creates an error with custom name
class CustomError extends Error {
    /* Source
    * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    */
    constructor(name: string, ...params: string[]) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CustomError);
        }
            
        this.name = name;
    }
}

interface ColorType {
    type: string,
    values: number[]
}

// determines if two arrays are equal (memberwise)
function isEqual(lhs: any[], rhs: any[]) {
    if (lhs.length !== rhs.length) return false;
    let output = true;
    for (var i = 0; i < lhs.length; ++i) {
        output = output && lhs[i] === rhs[i];
        if (!output) return output;
    }
    return output;
}

// returns a function that maps between the specified color spaces
function mapToColorSpace(clFrom: string, clTo: string): Function {
    if (clFrom === clTo) return (...args: number[]) => args[0];
    
    let convFunc: Function;
    let rxAlpha: RegExp;
    
    switch (true) {
        case /rgba?/.test(clFrom) && /rgba?/.test(clTo):
            convFunc = (r: number, g: number, b: number) => [r, g, b];
            rxAlpha = /[a-z]{3}a/;
            break;
        case /rgba?/.test(clFrom) && /hsla?/.test(clTo):
            convFunc = getHSLfromRGB;
            rxAlpha = /[a-z]{3}a/;
            break;
        case /rgba?/.test(clFrom) && /hs[vb]a?/.test(clTo):
            convFunc = getHSVfromRGB;
            rxAlpha = /[a-z]{3}a/;
            break;
        case /hsla?/.test(clFrom) && /hsla?/.test(clTo):
            convFunc = (h: number, s: number, l: number) => [h, s, l];
            rxAlpha = /[a-z]{3}a/;
            break;
        case /hsla?/.test(clFrom) && /rgba?/.test(clTo):
            convFunc = getRGBfromHSL;
            rxAlpha = /[a-z]{3}a/;
            break;
        case /hsla?/.test(clFrom) && /hs[vb]a?/.test(clTo):
            convFunc = getHSVfromHSL;
            rxAlpha = /[a-z]{3}a/;
            break;
        case /hs[vb]a?/.test(clFrom) && /hs[vb]a?/.test(clTo):
            convFunc = (h: number, s: number, v: number) => [h, s, v];
            rxAlpha = /[a-z]{3}a/;
            break;
        case /hs[vb]a?/.test(clFrom) && /rgba?/.test(clTo):
            convFunc = getRGBfromHSV;
            rxAlpha = /[a-z]{3}a/;
            break;
        case /hs[vb]a?/.test(clFrom) && /hsla?/.test(clTo):
            convFunc = getHSLfromHSV;
            rxAlpha = /[a-z]{3}a/;
            break;
        default:
            throw new CustomError('Argument error', `There is no conversion between ${clFrom} and ${clTo}`);
    }
    
    /*jshint bitwise: false */
    // bitfield to decide what to do with alpha disparity
    let aBf: number = (rxAlpha.test(clFrom) ? 1 : 0) | (rxAlpha.test(clTo) ? 2 : 0);
    /*jshint bitwise: true */
    
    switch (aBf) {
        case 0: // none to none - does nothing
            return (args: number[]) => convFunc(...args);
        case 1: // alpha to none - alpha value gets ignored
            return (args: number[]) => {return convFunc(...args);};
        case 2: // none to alpha - 1 is added as alpha value
            return (args: number[]) => {return convFunc(...args).concat(1);};
        case 3: // alpha to alpha - alpha value gets added to output
            return (args: number[]) => {let al = args.pop(); return convFunc(...args).concat(al);};
        default:
            throw new CustomError('Unknown error', `The bitfield has a value of ${aBf}. What kind of sorcery is this?`);
    }
}

// returns an array with RGB values from an HSL color space
function getRGBfromHSL(hue: number, sat: number, light: number) {
    const mod = (n: number, m: number) => (n * m >= 0 ? n % m : n % m + m);
    let ls_ratio: number = Math.min(light, 1 - light)*sat;
    
    return [0, 8, 4].map((offset, i) => {
        return mod((offset + hue/30), 12);
    }).map((kval, i) => {
        return light - ls_ratio*Math.max(Math.min(Math.min(kval - 3, 9 - kval), 1), -1);
    });
}

// returns an array with RGB values from an HSV color space
function getRGBfromHSV(hue: number, sat: number, value: number) {
    const mod = (n: number, m: number) => (n * m >= 0 ? n % m : n % m + m);
    let vs_ratio: number = value * sat;
    
    return [5, 3, 1].map((offset, i) => {
        return mod((offset + hue/60), 6);
    }).map((kval, i) => {
        return value - vs_ratio*Math.max(Math.min(Math.min(kval, 4 - kval),1),0);
    });
}

// returns an array with HSV values from an RGB color space
function getHSVfromRGB(red: number, green: number, blue: number) {
    let value: number = Math.max(red, green, blue);
    let range: number = value - Math.min(red, green, blue);
    
    let sat: number = (value === 0 ? 0 : range / value);
    let hue: number = 0;
    if (range === 0)          hue = 0;
    else if (value === red)   hue = 60 * (green - blue) / range;
    else if (value === green) hue = 60 * (2 + (blue - red) / range);
    else if (value === blue)  hue = 60 * (4 + (red - green) / range);
    
    return [hue, sat, value];
}

// returns an array with HSV values from an HSL color space
function getHSVfromHSL(hue: number, sat: number, light: number) {
    let v: number = light + sat * Math.min(light, 1 - light);
    let s: number = (v == 0 ? 0 : 2 * (1 - light / v));
    return [hue, s, v];
}

// returns an array with HSL values from an RGB color space
function getHSLfromRGB(red: number, green: number, blue: number) {
    let max: number = Math.max(red, green, blue);
    let range: number = max - Math.min(red, green, blue);
    
    let li: number = max - range / 2;
    let sat: number = (li == 0 || li == 1 ? 0 : (max - li) / Math.min(li, 1 - li));
    let hue: number = 0;
    if (range === 0)        hue = 0;
    else if (max === red)   hue = 60 * (green - blue) / range;
    else if (max === green) hue = 60 * (2 + (blue - red) / range);
    else if (max === blue)  hue = 60 * (4 + (red - green) / range);
    
    return [hue, sat, li];
}

// returns an array with HSL values from an HSV color space
function getHSLfromHSV(hue: number, sat: number, value: number) {
    let li: number = value * (1 - sat / 2);
    let s: number = (li == 0 || li == 1 ? 0 : (value - li) / Math.min(li, 1 - li));
    return [hue, s, li];
}

// returns an array containing the CSS funcion name and its parameters destructured and normalized (except for degree angles those stay as they are)
function parseCSSFunc(value: string): ColorType {
    const matchSignature: RegExp = /^([a-zA-Z]+)(\(.+\))$/i;
    const matchArgs: RegExp = /\(\s*([+-]?(?:\d*?\.)?\d+%?)\s*,\s*([+-]?(?:\d*?\.)?\d+%?)\s*,\s*([+-]?(?:\d*?\.)?\d+%?)\s*(?:,\s*([+-]?(?:\d*?\.)?\d+%?)\s*)?\)/;
    
    // map of non-numbers as parameters
    const NUMMAP_RGB: boolean[] = [false, false, false];
    const NUMMAP_HSL: boolean[] = [false, true, true];
    
    // gets function name and argument set
    let [ , funcName = '', argSet = ''] = value.trim().match(matchSignature) ?? [];
    // matches the list of arguments (trimmed)
    let args = argSet.match(matchArgs);
    if (args === null) throw new CustomError('Type error', 'the value provided is not a CSS function');
    // remove full match and alpha from array, store alpha in variable
    let alphaStr: string | undefined = (args = args.slice(1)).pop();
    let alpha = parseFloat(alphaStr ?? '')
    // truthy map if argument evaluates as NaN
    let pType: boolean[] = args.map(t => isNaN(Number(t)));
    
    let output: number[];
    
    // select the format of parameters
    switch (true) {
        case funcName === 'rgb':
        case funcName === 'rgba':
            if (!isEqual(pType, NUMMAP_RGB)) throw new CustomError('Argument error', 'RGB arguments are not valid');
            output = args.map((num) => {
                return parseFloat(num) / 255;
            });
            
            break;
        case funcName === 'hsl':
        case funcName === 'hsla':
            if (!isEqual(pType, NUMMAP_HSL)) throw new CustomError('Argument error', 'HSL parameters are not valid');
            output = args.map((num, i) => {
                return parseFloat(num) * (pType[i] ? 0.01 : 1);
            });
            break;
        default:
            throw new CustomError('Argument error', `${funcName} is not a recognized CSS function`);
    }
    
    if (alphaStr !== undefined) {
        if (funcName.length === 3) throw new CustomError('Argument error', `${funcName} function only recieves 3 arguments`);
        output.push(alpha * (isNaN(alpha) ? 0.01 : 1));
    }
    
    return {type: funcName, values: output}
}

// returns an array containing a desctructured version of a valid CSS hex color
function parseCSSHex(value: string) {
    const rxHex:RegExp = /^#((?:[0-9a-z]){3,8})$/i;
    
    let hexMatch: RegExpMatchArray | null = value.match(rxHex);
    if (hexMatch === null) throw new CustomError('Type error', 'the value provided is not a CSS hex color');
    let hex: string = hexMatch[1];
    
    let output: string[] | number[];
    switch (hex.length) {
        case 3:
            output = hex.match(/(.)(.)(.)/)?.splice(1) ?? [];
            output = output.map(elem => elem + elem);
            break;
        case 6:
            output = hex.match(/(..)(..)(..)/)?.splice(1) ?? [];
            break;
        case 4:
            output = hex.match(/(.)(.)(.)(.)/)?.splice(1) ?? [];
            output = output.map(elem => elem + elem);
            break;
        case 8:
            output = hex.match(/(..)(..)(..)(..)/)?.splice(1) ?? [];
            break;
        default:
            throw new CustomError('Argument error', `${value} is not a valid CSS hex color`);
    }
    
    output = output.map((item) => {
        return (Number(`0x${item}`)) / 255;
    });
    
    return output;
}

// Retruns the CSS hex value of given named CSS color
function parseNamedColor(input: string) {
    const NAME_TABLE: {[key: string]: string} = {
        'black' : '#000000', 'navy' : '#000080',
        'darkblue' : '#00008b', 'mediumblue' : '#0000cd',
        'blue' : '#0000ff', 'darkgreen' : '#006400',
        'green' : '#008000', 'teal' : '#008080',
        'darkcyan' : '#008b8b', 'deepskyblue' : '#00bfff',
        'darkturquoise' : '#00ced1', 'mediumspringgreen' : '#00fa9a',
        'lime' : '#00ff00', 'springgreen' : '#00ff7f',
        'aqua' : '#00ffff', 'cyan' : '#00ffff',
        'midnightblue' : '#191970', 'dodgerblue' : '#1e90ff',
        'lightseagreen' : '#20b2aa', 'forestgreen' : '#228b22',
        'seagreen' : '#2e8b57', 'darkslategray' : '#2f4f4f',
        'darkslategrey' : '#2f4f4f', 'limegreen' : '#32cd32',
        'mediumseagreen' : '#3cb371', 'turquoise' : '#40e0d0',
        'royalblue' : '#4169e1', 'steelblue' : '#4682b4',
        'darkslateblue' : '#483d8b', 'mediumturquoise' : '#48d1cc',
        'indigo' : '#4b0082', 'darkolivegreen' : '#556b2f',
        'cadetblue' : '#5f9ea0', 'cornflowerblue' : '#6495ed',
        'rebeccapurple' : '#663399', 'mediumaquamarine' : '#66cdaa',
        'dimgray' : '#696969', 'dimgrey' : '#696969',
        'slateblue' : '#6a5acd', 'olivedrab' : '#6b8e23',
        'slategray' : '#708090', 'slategrey' : '#708090',
        'lightslategray' : '#778899', 'lightslategrey' : '#778899',
        'mediumslateblue' : '#7b68ee', 'lawngreen' : '#7cfc00',
        'chartreuse' : '#7fff00', 'aquamarine' : '#7fffd4',
        'maroon' : '#800000', 'purple' : '#800080',
        'olive' : '#808000', 'gray' : '#808080',
        'grey' : '#808080', 'skyblue' : '#87ceeb',
        'lightskyblue' : '#87cefa', 'blueviolet' : '#8a2be2',
        'darkred' : '#8b0000', 'darkmagenta' : '#8b008b',
        'saddlebrown' : '#8b4513', 'darkseagreen' : '#8fbc8f',
        'lightgreen' : '#90ee90', 'mediumpurple' : '#9370db',
        'darkviolet' : '#9400d3', 'palegreen' : '#98fb98',
        'darkorchid' : '#9932cc', 'yellowgreen' : '#9acd32',
        'sienna' : '#a0522d', 'brown' : '#a52a2a',
        'darkgray' : '#a9a9a9', 'darkgrey' : '#a9a9a9',
        'lightblue' : '#add8e6', 'greenyellow' : '#adff2f',
        'paleturquoise' : '#afeeee', 'lightsteelblue' : '#b0c4de',
        'powderblue' : '#b0e0e6', 'firebrick' : '#b22222',
        'darkgoldenrod' : '#b8860b', 'mediumorchid' : '#ba55d3',
        'rosybrown' : '#bc8f8f', 'darkkhaki' : '#bdb76b',
        'silver' : '#c0c0c0', 'mediumvioletred' : '#c71585',
        'indianred' : '#cd5c5c', 'peru' : '#cd853f',
        'chocolate' : '#d2691e', 'tan' : '#d2b48c',
        'lightgray' : '#d3d3d3', 'lightgrey' : '#d3d3d3',
        'thistle' : '#d8bfd8', 'orchid' : '#da70d6',
        'goldenrod' : '#daa520', 'palevioletred' : '#db7093',
        'crimson' : '#dc143c', 'gainsboro' : '#dcdcdc',
        'plum' : '#dda0dd', 'burlywood' : '#deb887',
        'lightcyan' : '#e0ffff', 'lavender' : '#e6e6fa',
        'darksalmon' : '#e9967a', 'violet' : '#ee82ee',
        'palegoldenrod' : '#eee8aa', 'lightcoral' : '#f08080',
        'khaki' : '#f0e68c', 'aliceblue' : '#f0f8ff',
        'honeydew' : '#f0fff0', 'azure' : '#f0ffff',
        'sandybrown' : '#f4a460', 'wheat' : '#f5deb3',
        'beige' : '#f5f5dc', 'whitesmoke' : '#f5f5f5',
        'mintcream' : '#f5fffa', 'ghostwhite' : '#f8f8ff',
        'salmon' : '#fa8072', 'antiquewhite' : '#faebd7',
        'linen' : '#faf0e6', 'lightgoldenrodyellow' : '#fafad2',
        'oldlace' : '#fdf5e6', 'red' : '#ff0000',
        'fuchsia' : '#ff00ff', 'magenta' : '#ff00ff',
        'deeppink' : '#ff1493', 'orangered' : '#ff4500',
        'tomato' : '#ff6347', 'hotpink' : '#ff69b4',
        'coral' : '#ff7f50', 'darkorange' : '#ff8c00',
        'lightsalmon' : '#ffa07a', 'orange' : '#ffa500',
        'lightpink' : '#ffb6c1', 'pink' : '#ffc0cb',
        'gold' : '#ffd700', 'peachpuff' : '#ffdab9',
        'navajowhite' : '#ffdead', 'moccasin' : '#ffe4b5',
        'bisque' : '#ffe4c4', 'mistyrose' : '#ffe4e1',
        'blanchedalmond' : '#ffebcd', 'papayawhip' : '#ffefd5',
        'lavenderblush' : '#fff0f5', 'seashell' : '#fff5ee',
        'cornsilk' : '#fff8dc', 'lemonchiffon' : '#fffacd',
        'floralwhite' : '#fffaf0', 'snow' : '#fffafa',
        'yellow' : '#ffff00', 'lightyellow' : '#ffffe0',
        'ivory' : '#fffff0', 'white' : '#ffffff'
    }; // !NAME_TABLE
    
    if (NAME_TABLE.hasOwnProperty(input.toLowerCase())) {
        return NAME_TABLE[input.toLowerCase()];
    } else {
        throw new CustomError('Type error', input + ' is not a recognized named color');
    }
}

// returns an RGB array from any given CSS color
export default function getRGBpack(cssColor: string): number[] {
    // try if cssColor is a named color
    try {
        return parseCSSHex(parseNamedColor(cssColor));
    } catch (error) {
        // no need to log error, color might still be parsable
    }
    
    // try if cssColor is a hex value
    try {
        return parseCSSHex(cssColor);
    } catch (error) {
        // no need to log error, color might still be parsable
    }
    
    let colorPack: number[];
    // try if cssColor is a function
    try {
        let funcPar: ColorType = parseCSSFunc(cssColor);
        // maps current color space onto rgb
        colorPack = mapToColorSpace(funcPar.type, 'rgba')(funcPar.values);
    } catch (error: unknown) {
        // if (typeof error === "string") {
        //     console.error(error);
        // } else if (error instanceof Error) {
        //     console.error(`${error.name}:${error.message}`);
        // }
        colorPack = [0.5, 0.5, 0.5, 1]; // make gray on error
    }
    return colorPack
}