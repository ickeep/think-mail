// @ts-ignore
import { think, Context } from 'thinkjs'

export interface IConf {
  apiUser: string,
  apiKey: string,
  from: string,
  captchaTemplate?: string,
  logDb?: string,
  logTable?: string,
}

export interface ISendTemplateOpt {
  to: string[],
  sub: { '%action%': string[], '%code%': Array<string | number>, '%minute%': Array<string | number> }
}

export default class extends think.Service {
  conf: { [key: string]: any }

  constructor(conf = {}) {
    super()
    const dfOpts = {
      apiUser: '',
      apiKey: '',
      from: '',
      captchaTemplate: 'captcha',
      logDb: 'log',
      logTable: 'mail',
    }
    const dfConf = think.config('mail')
    this.conf = Object.assign(dfOpts, dfConf, conf)
  }

  async send(sendOpts: any, apiUrl: string, ctx: Context) {
    const url = apiUrl || 'http://api.sendcloud.net/apiv2/mail/send'
    const opts = Object.assign(this.conf, sendOpts)
    const postConf: any = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    const sendData = await think.httpPost(url, opts, postConf)
    const { code, msg, status, data } = sendData
    if (code === 0 && data.statusCode !== 200) {
      sendData.code = data.statusCode // http 请求成功  sendCloud 返回错误
      sendData.msg = data.message
      think.logger.error(sendData.msg)
    }
    const { logTable, logDb, to, xsmtpapi, apiKey, ...args } = opts
    if (logTable && logDb) {
      think.model(logTable, logDb).add({
        mail: to || xsmtpapi,
        opt: JSON.stringify(args),
        result: JSON.stringify({ code, msg, status, data }),
        time: Math.floor(new Date().getTime() / 1000),
        ip: ctx.ip
      })
    }
    return sendData
  }

  sendTemplate(name: string, sendOpt: ISendTemplateOpt, ctx: Context) {
    const opts = Object.assign(this.conf, {
      templateInvokeName: name,
      xsmtpapi: JSON.stringify(sendOpt)
    })
    return this.send(opts, 'http://api.sendcloud.net/apiv2/mail/sendtemplate', ctx)
  }

  sendCaptcha(mail: string, action: string, code: string | number, minute: any, ctx: Context) {
    const actionNameMap = { login: '登录', join: '注册', bind: '绑定', reset: '重置' }
    const actionName = actionNameMap[action] || ''
    const sendOpt = {
      to: [mail],
      sub: { '%action%': [actionName], '%code%': [code], '%minute%': [minute] }
    }
    return this.sendTemplate(this.conf.captchaTemplate, sendOpt, ctx)
  }
}
