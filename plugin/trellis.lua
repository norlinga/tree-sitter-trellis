local root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h")

vim.filetype.add({
  extension = {
    trellis = "trellis",
  },
})

local ok_parsers, parsers = pcall(require, "nvim-treesitter.parsers")
if ok_parsers then
  local parser_config = parsers.get_parser_configs()
  parser_config.trellis = vim.tbl_deep_extend("force", parser_config.trellis or {}, {
    install_info = {
      url = root,
      files = { "src/parser.c" },
      generate_requires_npm = false,
      requires_generate_from_grammar = false,
    },
    filetype = "trellis",
  })
end

local ok_devicons, devicons = pcall(require, "nvim-web-devicons")
if ok_devicons then
  devicons.set_icon({
    trellis = {
      icon = "",
      color = "#19b7c6",
      name = "Trellis",
    },
  })
  devicons.set_icon_by_filetype({
    trellis = "trellis",
  })
end
