import { useEffect, useState } from 'react'
import {
  Button,
  Spin,
  Input,
  Form,
  message,
  Table,
  Typography,
  Space,
  Modal,
  Popconfirm
} from 'antd'
import { ColumnsType } from 'antd/es/table'
import { JsonEditor } from 'json-edit-react'
import type { ProxyMap } from '@ying-tunnel/core'
import { useDialogOpen } from './use-dialog-open'

type Tunnel = {
  key: string
  proxyList: ProxyMap[]
}

type TunnelInfo = {
  tunnelServerHost: string
  tunnelServerPort: number
  tunnelList: Tunnel[]
}

const SESSION_KEY = 'access_session'

let session = localStorage.getItem(SESSION_KEY)

async function api(
  input: string | URL | globalThis.Request,
  init?: RequestInit
) {
  const headers: HeadersInit = {
    session: session || ''
  }

  if (init?.body) {
    headers['content-type'] = 'application/json; charset=utf-8'
  }

  const res = await fetch(input, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers
    }
  })

  const data = await res.json()

  if (res.status === 401) {
    localStorage.removeItem(SESSION_KEY)
    session = null
    location.reload()
  }

  if (res.status !== 200) {
    message.error(data.message)
    return Promise.reject(res.statusText + data.message)
  }

  return data
}

type EditModalProps = ReturnType<typeof useDialogOpen<Tunnel>> & {
  onSuccess: () => void
}

function EditModal({ open, onClose, formValue, onSuccess }: EditModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(formValue?.proxyList)

  useEffect(() => {
    if (formValue) {
      setData(formValue.proxyList)
    } else {
      setData([])
    }
  }, [formValue])

  const saveTunnelProxyList = async () => {
    try {
      setLoading(true)
      await api(`/api/tunnel${formValue?.key ? `/${formValue.key}` : ''}`, {
        method: 'POST',
        body: JSON.stringify(data)
      })

      onClose()
      onSuccess()
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={formValue ? '编辑' : '新增'}
      open={open}
      onCancel={onClose}
      cancelText="取消"
      okText="保存"
      onOk={saveTunnelProxyList}
      okButtonProps={{ loading }}
    >
      {data && (
        <JsonEditor
          collapse={false}
          rootName=""
          data={data}
          setData={data => setData(data as ProxyMap[])}
          onAdd={props => {
            ;(props.newData as ProxyMap[])[props.name as number] = {
              serverHost: '',
              localHost: ''
            }
          }}
        />
      )}
    </Modal>
  )
}

function App() {
  const [loading, setLoading] = useState(false)
  const [hasLogin, setHasLogin] = useState(!!session)

  const login = async ({ password }: { password: string }) => {
    try {
      setLoading(true)
      const res = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ password })
      })
      session = res.session
      localStorage.setItem(SESSION_KEY, res.session)
      setHasLogin(true)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo>()
  const getTunnelInfo = async () => {
    try {
      setLoading(true)
      const res = (await api('/api/tunnel-info', {
        method: 'GET'
      })) as TunnelInfo

      setTunnelInfo(res)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  const deleteTunnel = async (key: string) => {
    await api(`/api/tunnel/${key}`, {
      method: 'DELETE'
    })

    getTunnelInfo()
  }

  useEffect(() => {
    if (hasLogin) {
      getTunnelInfo()
    }
  }, [hasLogin])

  const modalProps = useDialogOpen<Tunnel>()

  const columns: ColumnsType<Tunnel> = [
    {
      title: 'key',
      ellipsis: true,
      dataIndex: 'key',
      width: 280,
      render: (_, record) => {
        return (
          <Typography.Text
            className="text-xl"
            code
            copyable={{
              tooltips: '一键复制连接信息',
              text: `ying-tunnel ${tunnelInfo?.tunnelServerHost} ${tunnelInfo?.tunnelServerPort} ${record.key}`
            }}
          >
            {record.key}
          </Typography.Text>
        )
      }
    },
    {
      title: '代理列表',
      ellipsis: true,
      dataIndex: 'proxyList',
      render: (_, record) => {
        return record.proxyList
          .map(el => `${el.serverHost}-->${el.localHost}`)
          .join('，')
      }
    },
    {
      title: '操作',
      key: 'operation',
      align: 'center',
      width: 100,
      fixed: 'right',
      render: (_, record) => {
        return (
          <Space>
            <Typography.Link onClick={() => modalProps.onOpen(record)}>
              编辑
            </Typography.Link>
            <Popconfirm
              title={`确定删除[${record.key}]？`}
              okText="确定"
              cancelText="取消"
              placement="left"
              onConfirm={() => deleteTunnel(record.key)}
            >
              <Typography.Link>删除</Typography.Link>
            </Popconfirm>
          </Space>
        )
      }
    }
  ]

  return (
    <>
      {hasLogin ? (
        <Spin size="large" spinning={loading}>
          <div className="mb-8 text-center">
            <Typography.Title level={3}>一、全局安装</Typography.Title>
            <Typography.Text
              className="text-lg!"
              code
              copyable={{ tooltips: false }}
            >
              npm i @ying-tunnel/cli -g
            </Typography.Text>
            <br />
            <Typography.Text
              className="text-lg!"
              code
              copyable={{ tooltips: false }}
            >
              pnpm i @ying-tunnel/cli -g
            </Typography.Text>
            <Typography.Title level={3} className="mt-2!">
              二、连接操作
            </Typography.Title>
            <Typography.Text
              className="text-lg!"
              code
              copyable={{ tooltips: false }}
            >
              {tunnelInfo &&
                `ying-tunnel ${tunnelInfo?.tunnelServerHost} ${tunnelInfo?.tunnelServerPort} <key> `}
            </Typography.Text>
          </div>
          <div className="mb-4 flex justify-end">
            <Button type="primary" onClick={() => modalProps.onOpen()}>
              新增代理连接
            </Button>
          </div>
          <Table
            rowKey="key"
            columns={columns}
            dataSource={tunnelInfo?.tunnelList}
            pagination={false}
          />
          <EditModal {...modalProps} onSuccess={getTunnelInfo} />
        </Spin>
      ) : (
        <div className="w-72">
          <div className="mb-4 text-2xl font-bold">登录</div>
          <Form name="login" size="large" onFinish={login}>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password type="password" placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="w-full"
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      )}
    </>
  )
}

export default App
