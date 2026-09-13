import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * ビルド後に dist/sw.js の __BUILD_ASSETS__ を、実際に出力された
 * ハッシュ付きファイル名で置き換える。
 * ファイル名はビルドごとに変わるので、sw.js に直接書いておくことができない。
 */
const injectAssetsIntoSW = () => ({
  name: 'inject-assets-into-sw',
  closeBundle() {
    const dist = path.resolve('dist')
    const swPath = path.join(dist, 'sw.js')
    if (!fs.existsSync(swPath)) return
    const assets = fs.existsSync(path.join(dist, 'assets'))
      ? fs
          .readdirSync(path.join(dist, 'assets'))
          .filter((f) => /\.(js|css)$/.test(f))
          .map((f) => `./assets/${f}`)
      : []
    const sw = fs
      .readFileSync(swPath, 'utf-8')
      .replace('self.__BUILD_ASSETS__ = []', `self.__BUILD_ASSETS__ = ${JSON.stringify(assets)}`)
    fs.writeFileSync(swPath, sw)
    console.log(`[sw] 事前キャッシュに ${assets.length} 件のアセットを登録`)
  },
})

export default defineConfig({
  plugins: [react(), injectAssetsIntoSW()],
  base: './',
})
