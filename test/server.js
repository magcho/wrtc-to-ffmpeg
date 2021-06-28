const ffmpeg = require('fluent-ffmpeg')
const wrtc = require('wrtc')
const w2f = require('../src')(wrtc)
const Peer = require('simple-peer')

var ws = require('ws')
var server = new ws.Server({
  port: 9000
})

server.on('connection', function (socket) {
  const peer = new Peer({ initiator: false, wrtc })

  socket.on('message', (data) => {
    peer.signal(data)
  })
  peer.on('signal', (data) => {
    socket.send(JSON.stringify(data))
  })
  peer.on('stream', async (stream) => {
    // const video = stream.getVideoTracks().map((track, index) => {
    //   const sink = new wrtc.nonstandard.RTCVideoSink(track)
    //   const source = new wrtc.nonstandard.RTCVideoSource()
    //   sink.onframe = ({ frame }) => {
    //     console.log(frame.timestamp)
    //     source.onFrame(frame)
    //   }
    //   return source.createTrack()
    // })

    // const audio = stream.getAudioTracks().map((track, index) => {
    //   const sink = new wrtc.nonstandard.RTCAudioSink(track)
    //   const source = new wrtc.nonstandard.RTCAudioSource()
    //   sink.ondata = (event) => {
    //     console.log(Date.now())
    //     source.onData(event)
    //   }
    //   return source.createTrack()
    // })

    // const outputStream = new wrtc.MediaStream(video.concat(audio))
    // peer.addStream(outputStream)

    const inputs = await Promise.all(stream.getTracks().map(track => w2f.input(track)))
    const outputs = await Promise.all(inputs.map(input => {
      return w2f.output({
        kind: input.kind,
        width: input.width,
        height: input.height,
        sampleRate: 48000
      })
    }))

    const command = ffmpeg()
    command.addOption('-loglevel debug')

    inputs.forEach(input => {
      command
        .addInput(input.url)
        .inputOptions(input.options)
      // // .output('./out.mp4');
      //   .outputOptions([
      //     '-f flv',
      //     '-flvflags no_duration_filesize'
      //   ])
      //   .addOutput(`rtmp://127.0.0.1:1935/live/livekey`)
    })
    outputs.forEach(output => {
      command
        .output(output.url)
        .outputOptions(output.options)
    })
    // command.addOutputOption('-vf transpose=2,transpose=2,format=yuv420p')

    const input = inputs[0];
    const command2 = ffmpeg();
    command2
      .addInput(input.url)
      .inputOptions(input.options)
      .outputOptions([
        '-f flv',
         '-flvflags no_duration_filesize'
      ])
      .output('rtmp://localhost:1935/live/test1')
      .strem();



    command.on('stderr', (line) => {
      console.log(line);
    })
      .on('start', cmd => {
        console.log(cmd)
      })
      .run()

    const outputStream = new wrtc.MediaStream(outputs.map(o => o.track))
    peer.addStream(outputStream)
  })
})
