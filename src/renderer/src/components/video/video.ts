/**
 * 视频采集工具（Electron 环境，无需兼容旧浏览器）。
 * 设备优先级：VGA2USB 采集卡 > 其他摄像头 > Camera（放最后）。
 */

/** 获取视频输入设备列表 */
export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = (await navigator.mediaDevices.enumerateDevices()) || []
  const list = devices.filter((device) => device.kind === 'videoinput')
  if (!list.length) {
    throw new Error('未找到视频设备')
  }

  // VGA2USB 优先
  const vgaIndex = list.findIndex((device) => device.label.toUpperCase().includes('VGA2USB'))
  if (vgaIndex > -1) {
    const [vga] = list.splice(vgaIndex, 1)
    list.unshift(vga)
  }

  // Camera 放最后
  const cameraIndex = list.findIndex((device) => device.label.toUpperCase().includes('CAMERA'))
  if (cameraIndex > -1) {
    const [camera] = list.splice(cameraIndex, 1)
    list.push(camera)
  }

  return list
}

/** 打开指定视频设备 */
export function getUserMedia(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { deviceId: { exact: deviceId } }
  })
}

/** 停止视频流 */
export function stopStream(stream: MediaStream | null): void {
  if (stream && typeof stream.getTracks === 'function') {
    stream.getTracks().forEach((track) => track.stop())
  }
}
