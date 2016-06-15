import React, {PropTypes} from 'react'
import LoginStatus from '../../components/LoginStatus'
import {parseWebviewCookiesByDomain} from '../../../electron/ipc_render'
import * as DataUtils from '../client_data'
import styles from './CreateLogin.css'

export default React.createClass({
  propTypes: {
    states: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired,
    children: PropTypes.any,
    platformName: PropTypes.string.isRequired,
    platformLabel: PropTypes.string.isRequired,
    loginUrl: PropTypes.string.isRequired,
    // 登录之后的目标首页
    loggedInUrl: PropTypes.string.isRequired,
    logoutUrl: PropTypes.string.isRequired,
    // 一级域名
    domain: PropTypes.string.isRequired,
    whoAmI: PropTypes.func.isRequired,
    // whoami 接口可能需要额外的参数
    transformCookie: PropTypes.func,
    onLoggedIn: PropTypes.func.isRequired,
    onLoggedout: PropTypes.func
  },

  getInitialState() {
    return {
      isLoggingOut: null
    }
  },

  getDefaultProps() {
    return {
      transformCookie(cookie) {
        return cookie
      }
    }
  },

  componentDidUpdate(nextProps, nextState) {
    let isLogin = this.props.states.account[this.props.platformName]
    let isLoggingOut = this.state.isLoggingOut
    // 注销时绑定事件
    if (!isLogin && isLoggingOut === false) {
      this.onWebviewMounted()
    }
  },

  componentDidMount() {
    this.onWebviewMounted()
  },

  handleLogout() {
    let name = this.props.platformName
    this.setState({
      isLoggingOut: true
    }, () => {
      let webview = this.refs.webview
      webview.addEventListener('did-get-response-details', (e) => {
        this.props.actions.accountUpdate({
          platform: name,
          value: null
        })
        DataUtils.removeAccountByPlatform(name)
        if (this.props.onLoggedout) {
          this.props.onLoggedout(this.props)
        }

        this.setState({
          isLoggingOut: false
        })
      })
    })
  },

  onWebviewMounted() {
    let webview = this.refs.webview
    if (!webview) {
      console.warn('webview is not mounted.')
      return
    }

    webview.addEventListener('did-navigate', (e) => {
      if (e.url === this.props.loggedInUrl) {
        let platformName = this.props.platformName
        let clientData
        let session = webview.getWebContents().session
        parseWebviewCookiesByDomain(session, this.props.domain)
        .then(cookie => {
          // 需要从cookie中提取一些数据比如token
          clientData = this.props.transformCookie(cookie)
          return this.props.whoAmI({
            [platformName]: clientData
          })
        }).then(json => {
          let account = this.props.onLoggedIn(clientData, json[platformName])
          this.props.actions.accountUpdate({
            platform: platformName,
            value: account
          })
        }).catch(err => {
          console.log(err)
          App.alert('登录出错', err.message)
        })
      }
    })
  },

  _render() {
    let accountMap = this.props.states.account
    let name = this.props.platformName
    if (accountMap[name]) {
      return (
        <div className={styles.formContainer}>
          <h2>{this.props.platformLabel}</h2>
          <LoginStatus
            username={accountMap[name].username}
            onLogout={this.handleLogout}
          />

          {this.props.children}

          {
            this.state.isLoggingOut && (
              <webview
                disablewebsecurity
                ref="webview"
                className={styles.hide}
                src={this.props.logoutUrl}
                partition={`persist:${name}`}
              />
            )
          }
        </div>
      )
    }

    return (
      <webview
        disablewebsecurity
        ref="webview"
        className={styles.normal}
        src={this.props.loginUrl}
        partition={`persist:${name}`}
      />
    )
  },

  render() {
    return (
      <div className={styles.container}>
        {this._render()}
      </div>
    )
  }
})
