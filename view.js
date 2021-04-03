import DCGView from 'DCGView'
import ReplaceBar from './ReplaceBar'

let mountNode

export function initView () {
  const searchBar = document.querySelector('.dcg-expression-search-bar')
  const searchContainer = document.createElement('div')
  searchContainer.style.display = 'flex'
  searchContainer.style.flexDirection = 'column'
  searchBar.parentNode.insertBefore(searchContainer, searchBar)
  searchContainer.appendChild(searchBar)
  mountNode = document.createElement('div')
  mountNode.className = '.findandreplace-expression-replace-bar'
  searchContainer.appendChild(mountNode)
  DCGView.mountToNode(
    ReplaceBar,
    mountNode,
    {}
  )
}

export function destroyView () {
  DCGView.unmountFromNode(mountNode)
}
