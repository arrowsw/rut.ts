const invalidRutError = (rut: string): string => `String "${rut}" is not valid as a RUT input`

const clean = (rut: string) : string => {
    const r = rut.replace(/^0+|[^0-9kK]+/g, '').toUpperCase()
    if (r.length < 8 || r.length > 9) throw new Error(invalidRutError(rut))
    return r
}

const check = (rut: string): boolean => {
    if (!/^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/.test(rut)) return false

    if (/^0+/.test(rut)) return false

    if (!/^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/.test(rut)) return false

    const r = clean(rut)

    let t = parseInt(r.slice(0, -1), 10)
    let m = 0
    let s = 1

    while (t > 0) {
        s = (s + (t % 10) * (9 - (m++ % 6))) % 11
        t = Math.floor(t / 10)
    }

    const v = s > 0 ? '' + (s - 1) : 'K'
    return v === r.slice(-1)
}

const format = (rut: string, dots: boolean = true) : string => {
    if(rut.length === 0) return ''
    const r = clean(rut)
    if (dots) {
        let result = r.slice(-4, -1) + '-' + r.substring(r.length - 1)
        for (let i = 4; i < r.length; i += 3) {
            result = r.slice(-3 - i, -i) + '.' + result
        }
        return result
    }
    return r.slice(0, -1) + '-' + r.substring(r.length - 1)
}

const getVerifierDigit = (rut: string): string => {
    const r = Array.from(clean(rut), Number)

    if (r.length === 0 || r.includes(NaN)) {
        throw new Error(invalidRutError(rut))
    }

    const modulus = 11
    const initialValue = 0
    const sumResult = r
        .reverse()
        .reduce(
            (accumulator, currentValue, index) =>
                accumulator + currentValue * ((index % 6) + 2),
            initialValue
        )

    const verifierDigit = modulus - (sumResult % modulus)

    if (verifierDigit === 10) return 'K'
    if (verifierDigit === 11) return '0'

    return `${verifierDigit}`
}

export { check, clean, format, getVerifierDigit }


