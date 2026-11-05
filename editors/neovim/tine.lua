-- Neovim setup for Tine. Put this in your config (e.g. ~/.config/nvim/after/plugin/tine.lua)
-- and add editors/vim to your runtimepath for highlighting:  vim.opt.rtp:append("/path/to/tine/editors/vim")
vim.filetype.add({ extension = { tine = "tine" } })
vim.api.nvim_create_autocmd("FileType", {
  pattern = "tine",
  callback = function(args)
    vim.lsp.start({
      name = "tine",
      cmd = { "tine", "lsp" },
      root_dir = vim.fs.dirname(vim.fs.find({ ".git" }, { upward = true, path = args.file })[1] or args.file),
    })
  end,
})
-- Live performance: open the DAW on the current file (it reloads on every :w)
vim.api.nvim_create_user_command("TineDaw", function() vim.fn.jobstart({ "tine", "daw", vim.fn.expand("%:p") }, { detach = true }) end, {})
